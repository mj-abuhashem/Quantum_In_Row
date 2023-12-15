
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function validate_store(store, name) {
        if (!store || typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, callback) {
        const unsub = store.subscribe(callback);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let stylesheet;
    let active = 0;
    let current_rules = {};
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        if (!current_rules[name]) {
            if (!stylesheet) {
                const style = element('style');
                document.head.appendChild(style);
                stylesheet = style.sheet;
            }
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        node.style.animation = (node.style.animation || '')
            .split(', ')
            .filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        )
            .join(', ');
        if (name && !--active)
            clear_rules();
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            current_rules = {};
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            $$.fragment && $$.fragment.p($$.ctx, $$.dirty);
            $$.dirty = [-1];
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_out_transition(node, fn, params) {
        let config = fn(node, params);
        let running = true;
        let animation_name;
        const group = outros;
        group.r += 1;
        function go() {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            if (css)
                animation_name = create_rule(node, 1, 0, duration, delay, easing, css);
            const start_time = now() + delay;
            const end_time = start_time + duration;
            add_render_callback(() => dispatch(node, false, 'start'));
            loop(now => {
                if (running) {
                    if (now >= end_time) {
                        tick(0, 1);
                        dispatch(node, false, 'end');
                        if (!--group.r) {
                            // this will result in `end()` being called,
                            // so we don't need to clean up here
                            run_all(group.c);
                        }
                        return false;
                    }
                    if (now >= start_time) {
                        const t = easing((now - start_time) / duration);
                        tick(1 - t, t);
                    }
                }
                return running;
            });
        }
        if (is_function(config)) {
            wait().then(() => {
                // @ts-ignore
                config = config();
                go();
            });
        }
        else {
            go();
        }
        return {
            end(reset) {
                if (reset && config.tick) {
                    config.tick(1, 0);
                }
                if (running) {
                    if (animation_name)
                        delete_rule(node, animation_name);
                    running = false;
                }
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                info.blocks[i] = null;
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev("SvelteDOMSetData", { node: text, data });
        text.data = data;
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const playing = writable(false);

    class Board {
      constructor(player, { rows, cols }) {
        this.activePlayer = player;
        this.rows = rows;
        this.cols = cols;
        this.board = Array.from({ length: rows })
          .map((_, i) => "R" + i)
          .map(row => Array.from({ length: cols }).map((_, i) => row + " C" + i));

        this.filledCells = 0;
        this.superPositions = []; // TODO
      }
      occupySlot({ colIndex }) {
        let rowIndex = this.board.length - 1;
        while (rowIndex >= 0) {
          if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
            this.board[rowIndex][colIndex] = this.activePlayer.marker;
            this.filledCells++;
            return;
          }
          rowIndex--;
        }
      }
      isColAvailable(colIndex) {
        let rowIndex = this.board.length - 1;
        while (rowIndex >= 0) {
          if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
            return true;
          }
          rowIndex--;
        }
        return false;
      }

      occupySlotWithSuperPosition({ superPositionCount, colIndex }) {
        let rowIndex = this.board.length - 1;
        while (rowIndex >= 0) {

          if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
            this.board[rowIndex][colIndex] =
              this.activePlayer.marker + superPositionCount;
            this.filledCells++;
            return rowIndex;
          }
          rowIndex--;
        }
      }
      setActivePlayer(player) {
        this.activePlayer = player;
      }
      getBoard() {
        return this.board;
      }
      isAlreadyOccupied(rowIndex, colIndex) {
        return (
          this.board[rowIndex][colIndex].includes(BROWN_MARKER) ||
          this.board[rowIndex][colIndex].includes(GREEN_MARKER)
        );
      }
      isFull() {
        return this.filledCells === this.rows * this.cols;
      }
      isPlayerMarker(rowIndex, colIndex) {
        return (
          this.board[rowIndex][colIndex] === BROWN_MARKER ||
          this.board[rowIndex][colIndex] === GREEN_MARKER
        );
      }
      applyQuantumGate(gate) {
        for (let i = 0; i < gate.length; i++) {
          if (gate.charAt(i) === "0") {
            const posRemove = this.superPositions[i][1];
            this.updateColour(posRemove.R, posRemove.C);


            const posKeep = this.superPositions[i][0];
            this.updateColour(posKeep.R, posKeep.C);
          } else {
            const posRemove = this.superPositions[i][0];
            this.updateColour(posRemove.R, posRemove.C);

            const posKeep = this.superPositions[i][1];
            this.updateColour(posKeep.R, posKeep.C);
          }
        }


        const cleanBoard = () => {
          for (let colIndex = 0; colIndex < this.cols; colIndex++) {
            let rowIndex = this.board.length - 1;
            while (rowIndex >= 0) {
              if (
                rowIndex - 1 >= 0 &&
                !this.isPlayerMarker(rowIndex, colIndex) &&
                this.isPlayerMarker(rowIndex - 1, colIndex)
              ) {

                this.board[rowIndex][colIndex] = this.board[rowIndex - 1][colIndex];
                this.board[rowIndex - 1][colIndex] =
                  "R" + rowIndex + " C" + colIndex;
              }

              rowIndex--;
            }
          }
        };

        for (let index = 0; index < this.rows * this.cols; index++) {
          cleanBoard();
        }

        this.filledCells =
          this.board.rows * this.board.cols - 2 * this.superPositions.length;
        this.superPositions = [];

      }

      updateColour(r, c) {
        if (this.board[r][c].includes(BROWN_MARKER)) {
          this.board[r][c] = BROWN_MARKER;
        } else if (this.board[r][c].includes(GREEN_MARKER)) {
          this.board[r][c] = GREEN_MARKER;
        } else {
          this.board[r][c] = "R" + r + " C" + c;
        }
      }

      addSuperPosition(arr) {
        this.superPositions.push(arr);
      }

      hasPlayerWon() {
        let element;
        const checkRows = () => {
          for (let row = 0; row < this.board.length; row++) {
            for (let col = 0; col < this.board[row].length - 3; col++) {
              element = this.board[row][col];
              if (
                element == this.board[row][col + 1] &&
                element == this.board[row][col + 2] &&
                element == this.board[row][col + 3]
              ) {
                return true;
              }
            }
          }
          return false;
        };

        const checkColumns = () => {
          for (let row = 0; row < this.board.length - 3; row++) {
            for (let col = 0; col < this.board[row].length; col++) {
              element = this.board[row][col];
              if (
                element == this.board[row + 1][col] &&
                element == this.board[row + 2][col] &&
                element == this.board[row + 3][col]
              ) {
                return true;
              }
            }
          }
          return false;
        };
        const checkMainDiagonal = () => {
          for (let row = 0; row < this.board.length - 3; row++) {
            for (let col = 0; col < this.board[row].length - 3; col++) {
              element = this.board[row][col];
              if (
                element == this.board[row + 1][col + 1] &&
                element == this.board[row + 2][col + 2] &&
                element == this.board[row + 3][col + 3]
              ) {
                return true;
              }
            }
          }
          return false;
        };

        const checkCounterDiagonal = () => {
          for (let row = 0; row < this.board.length - 3; row++) {
            for (let col = 3; col < this.board[row].length; col++) {
              element = this.board[row][col];
              if (
                element == this.board[row + 1][col - 1] &&
                element == this.board[row + 2][col - 2] &&
                element == this.board[row + 3][col - 3]
              ) {
                return true;
              }
            }
          }
          return false;
        };
        if (
          checkRows() ||
          checkColumns() ||
          checkMainDiagonal() ||
          checkCounterDiagonal()
        ) {
          return element;
        }
        return false;
      }
    }
    class Player {
      constructor(name, marker) {
        this.name = name;
        this.marker = marker;
      }
    }

    const BROWN_MARKER = "BROWN";
    const GREEN_MARKER = "GREEN";

    function fade(node, { delay = 0, duration = 400, easing = identity }) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* src/component/Frame.svelte generated by Svelte v3.16.4 */
    const file = "src/component/Frame.svelte";

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	child_ctx[22] = i;
    	return child_ctx;
    }

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	child_ctx[19] = i;
    	return child_ctx;
    }

    // (171:2) {:else}
    function create_else_block_1(ctx) {
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*superPositionActivated*/ ctx[2]) return create_if_block_5;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(/*activePlayerName*/ ctx[4]);
    			t1 = text("'s turn");
    			t2 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			set_style(h2, "margin-left", "0rem");

    			set_style(h2, "color", /*activePlayerName*/ ctx[4] === "PLAYER2"
    			? "red"
    			: "black");

    			attr_dev(h2, "class", "svelte-8hf4ik");
    			add_location(h2, file, 172, 6, 4315);
    			attr_dev(div, "class", "flex flex-center");
    			add_location(div, file, 171, 4, 4278);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			insert_dev(target, t2, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*activePlayerName*/ 16) set_data_dev(t0, /*activePlayerName*/ ctx[4]);

    			if (dirty[0] & /*activePlayerName*/ 16) {
    				set_style(h2, "color", /*activePlayerName*/ ctx[4] === "PLAYER2"
    				? "red"
    				: "black");
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t2);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(171:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (162:2) {#if winnerName}
    function create_if_block_4(ctx) {
    	let div;
    	let h2;
    	let t0;
    	let t1;
    	let h2_outro;
    	let current;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h2 = element("h2");
    			t0 = text(/*winnerName*/ ctx[1]);
    			t1 = text(" Won!");
    			set_style(h2, "margin-left", "7rem");
    			set_style(h2, "color", "pink");
    			attr_dev(h2, "class", "svelte-8hf4ik");
    			add_location(h2, file, 163, 6, 4139);
    			attr_dev(div, "class", "flex flex-center");
    			add_location(div, file, 162, 4, 4102);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h2);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!current || dirty[0] & /*winnerName*/ 2) set_data_dev(t0, /*winnerName*/ ctx[1]);
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (h2_outro) h2_outro.end(1);
    			current = true;
    		},
    		o: function outro(local) {
    			h2_outro = create_out_transition(h2, fade, {});
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching && h2_outro) h2_outro.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(162:2) {#if winnerName}",
    		ctx
    	});

    	return block;
    }

    // (182:4) {:else}
    function create_else_block_2(ctx) {
    	let div;
    	let button;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			button.textContent = "Activate Quantum Move";
    			attr_dev(button, "class", "big-btn svelte-8hf4ik");
    			set_style(button, "background-color", "white");
    			set_style(button, "color", "black");
    			add_location(button, file, 183, 8, 4686);
    			attr_dev(div, "class", "flex flex-center");
    			add_location(div, file, 182, 6, 4646);
    			dispose = listen_dev(button, "click", /*click_handler*/ ctx[15], false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(182:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (178:4) {#if superPositionActivated}
    function create_if_block_5(ctx) {
    	let div;
    	let h4;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h4 = element("h4");
    			h4.textContent = "Superposition is Active";
    			add_location(h4, file, 179, 8, 4582);
    			attr_dev(div, "class", "flex flex-center");
    			set_style(div, "margin-left", "7rem");
    			set_style(div, "color", "blue");
    			add_location(div, file, 178, 6, 4507);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h4);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(178:4) {#if superPositionActivated}",
    		ctx
    	});

    	return block;
    }

    // (219:18) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "circle empty svelte-8hf4ik");
    			add_location(div, file, 219, 20, 5947);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(219:18) {:else}",
    		ctx
    	});

    	return block;
    }

    // (215:58) 
    function create_if_block_3(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "circle superBROWN svelte-8hf4ik");
    			add_location(div, file, 215, 20, 5823);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(215:58) ",
    		ctx
    	});

    	return block;
    }

    // (211:58) 
    function create_if_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "circle superGREEN svelte-8hf4ik");
    			add_location(div, file, 211, 20, 5667);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(211:58) ",
    		ctx
    	});

    	return block;
    }

    // (207:52) 
    function create_if_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "circle BROWN svelte-8hf4ik");
    			add_location(div, file, 207, 20, 5514);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(207:52) ",
    		ctx
    	});

    	return block;
    }

    // (203:18) {#if column === GREEN_MARKER}
    function create_if_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "circle GREEN svelte-8hf4ik");
    			add_location(div, file, 203, 20, 5367);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(203:18) {#if column === GREEN_MARKER}",
    		ctx
    	});

    	return block;
    }

    // (199:14) {#each rows as column, colIndex}
    function create_each_block_1(ctx) {
    	let td;
    	let show_if;
    	let show_if_1;
    	let td_id_value;
    	let dispose;

    	function select_block_type_2(ctx, dirty) {
    		if (/*column*/ ctx[20] === GREEN_MARKER) return create_if_block;
    		if (/*column*/ ctx[20] === BROWN_MARKER) return create_if_block_1;
    		if (show_if == null || dirty[0] & /*activeBoard*/ 1) show_if = !!/*column*/ ctx[20].includes(GREEN_MARKER);
    		if (show_if) return create_if_block_2;
    		if (show_if_1 == null || dirty[0] & /*activeBoard*/ 1) show_if_1 = !!/*column*/ ctx[20].includes(BROWN_MARKER);
    		if (show_if_1) return create_if_block_3;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_2(ctx, -1);
    	let if_block = current_block_type(ctx);

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[16](/*colIndex*/ ctx[22], /*rowIndex*/ ctx[19], ...args);
    	}

    	const block = {
    		c: function create() {
    			td = element("td");
    			if_block.c();
    			attr_dev(td, "id", td_id_value = "R" + /*rowIndex*/ ctx[19] + "C" + /*colIndex*/ ctx[22]);
    			add_location(td, file, 199, 16, 5163);
    			dispose = listen_dev(td, "click", click_handler_1, false, false, false);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			if_block.m(td, null);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type !== (current_block_type = select_block_type_2(ctx, dirty))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(td, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    			if_block.d();
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(199:14) {#each rows as column, colIndex}",
    		ctx
    	});

    	return block;
    }

    // (197:10) {#each activeBoard as rows, rowIndex}
    function create_each_block(ctx) {
    	let tr;
    	let t;
    	let each_value_1 = /*rows*/ ctx[17];
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			tr = element("tr");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			add_location(tr, file, 197, 12, 5095);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			append_dev(tr, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*handlePlayerMove, activeBoard*/ 33) {
    				each_value_1 = /*rows*/ ctx[17];
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tr, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(197:10) {#each activeBoard as rows, rowIndex}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div2;
    	let current_block_type_index;
    	let if_block;
    	let t0;
    	let center;
    	let div1;
    	let div0;
    	let table;
    	let tbody;
    	let t1;
    	let button;
    	let t2;
    	let button_hidden_value;
    	let current;
    	let dispose;
    	const if_block_creators = [create_if_block_4, create_else_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*winnerName*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	let each_value = /*activeBoard*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			if_block.c();
    			t0 = space();
    			center = element("center");
    			div1 = element("div");
    			div0 = element("div");
    			table = element("table");
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t1 = space();
    			button = element("button");
    			t2 = text("Collapse");
    			add_location(tbody, file, 195, 8, 5027);
    			attr_dev(table, "width", "50vW");
    			attr_dev(table, "height", "50vH");
    			add_location(table, file, 194, 6, 4984);
    			add_location(div0, file, 193, 4, 4972);
    			attr_dev(div1, "class", "column padding-all-1 flex flex-center");
    			add_location(div1, file, 192, 2, 4915);
    			add_location(center, file, 191, 0, 4904);
    			button.hidden = button_hidden_value = /*superPositionCount*/ ctx[3] <= 0 || /*winnerName*/ ctx[1];
    			attr_dev(button, "class", "big-btn svelte-8hf4ik");
    			set_style(button, "background-color", "white");
    			set_style(button, "color", "black");
    			add_location(button, file, 230, 2, 6144);
    			add_location(div2, file, 160, 0, 4073);
    			dispose = listen_dev(button, "click", /*collapseForPlayer*/ ctx[6], false, false, false);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			if_blocks[current_block_type_index].m(div2, null);
    			append_dev(div2, t0);
    			append_dev(div2, center);
    			append_dev(center, div1);
    			append_dev(div1, div0);
    			append_dev(div0, table);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			append_dev(div2, t1);
    			append_dev(div2, button);
    			append_dev(button, t2);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div2, t0);
    			}

    			if (dirty[0] & /*activeBoard, handlePlayerMove*/ 33) {
    				each_value = /*activeBoard*/ ctx[0];
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty[0] & /*superPositionCount, winnerName*/ 10 && button_hidden_value !== (button_hidden_value = /*superPositionCount*/ ctx[3] <= 0 || /*winnerName*/ ctx[1])) {
    				prop_dev(button, "hidden", button_hidden_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			if_blocks[current_block_type_index].d();
    			destroy_each(each_blocks, detaching);
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const BACKEND_URL = "http://localhost:3000/api";

    function instance($$self, $$props, $$invalidate) {
    	const PLAYER1 = new Player("Red", BROWN_MARKER);
    	const PLAYER2 = new Player("Green", GREEN_MARKER);
    	let gameBoard = new Board(PLAYER1, { rows: 6, cols: 7 });
    	let activeBoard = gameBoard.getBoard();
    	let winnerName;
    	let superPositionActivated = false;
    	let superPositionColumns = [];
    	let superPositionCount = 0;
    	let activePlayerName = gameBoard.activePlayer.name;

    	const switchActivePlayer = () => {
    		if (gameBoard.activePlayer.name === PLAYER1.name) {
    			gameBoard.setActivePlayer(PLAYER2);
    			$$invalidate(4, activePlayerName = PLAYER2.name);
    		} else {
    			gameBoard.setActivePlayer(PLAYER1);
    			$$invalidate(4, activePlayerName = PLAYER1.name);
    		}
    	};

    	const handleSuperPosition = async ({ rowIndex, colIndex }) => {
    		$$invalidate(2, superPositionActivated = true);

    		if (superPositionActivated) {
    			if (!gameBoard.isColAvailable(colIndex)) {
    				alert("column already full");
    			}

    			const plantedRow = gameBoard.occupySlotWithSuperPosition({ superPositionCount, rowIndex, colIndex });
    			superPositionColumns.push({ R: plantedRow, C: colIndex });

    			if (superPositionColumns.length === 2) {
    				gameBoard.addSuperPosition(superPositionColumns);
    				$$invalidate(2, superPositionActivated = false);
    				superPositionColumns = [];
    				$$invalidate(3, superPositionCount++, superPositionCount);
    				switchActivePlayer();
    			}
    		}
    	};

    	const handlePlayerMove = async ({ rowIndex, colIndex }) => {
    		if (!gameBoard.isColAvailable(colIndex)) {
    			alert("column already full");
    			return;
    		}

    		if (await canProceed()) {
    			if (superPositionActivated) {
    				handleSuperPosition({ rowIndex, colIndex });
    			} else {
    				gameBoard.occupySlot({ rowIndex, colIndex });
    				switchActivePlayer();
    			}

    			$$invalidate(0, activeBoard = [...gameBoard.getBoard()]);
    		}

    		await canProceed();
    	};

    	const canProceed = async () => {
    		let winner = gameBoard.hasPlayerWon();

    		if (gameBoard.isFull()) {
    			if (!winner) {
    				quantumGate = await computeCollapse();
    				gameBoard.applyQuantumGate(quantumGate);
    				winner = gameBoard.hasPlayerWon();

    				if (!winner) {
    					return false;
    				}
    			}
    		}

    		winner = gameBoard.hasPlayerWon();

    		if (winner) {
    			if (PLAYER1.marker === winner) {
    				$$invalidate(1, winnerName = PLAYER1.name);
    			} else {
    				$$invalidate(1, winnerName = PLAYER2.name);
    			}

    			return false;
    		}

    		return true;
    	};

    	const computeCollapse = async () => {
    		const payload = {
    			super_positions: gameBoard.superPositions.length
    		};

    		const res = await fetch(`${BACKEND_URL}/collapse`, {
    			method: "POST",
    			headers: {
    				Accept: "application/json",
    				"Content-Type": "application/json"
    			},
    			body: JSON.stringify(payload)
    		}).then(async response => {
    			if (response.ok) {
    				const data = await response.json();
    				return data.res;
    			} else return "";
    		}).catch(error => {
    			return Promise.reject(error);
    		});

    		return res;
    	};

    	const collapseForPlayer = async () => {
    		let quantumGate = await computeCollapse();
    		gameBoard.applyQuantumGate(quantumGate);
    		gameBoard.applyQuantumGate(quantumGate);
    		$$invalidate(0, activeBoard = [...gameBoard.getBoard()]);
    		if (await canProceed()) switchActivePlayer();
    	};

    	const click_handler = () => $$invalidate(2, superPositionActivated = true);
    	const click_handler_1 = (colIndex, rowIndex) => handlePlayerMove({ colIndex, rowIndex });

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("gameBoard" in $$props) gameBoard = $$props.gameBoard;
    		if ("activeBoard" in $$props) $$invalidate(0, activeBoard = $$props.activeBoard);
    		if ("winnerName" in $$props) $$invalidate(1, winnerName = $$props.winnerName);
    		if ("superPositionActivated" in $$props) $$invalidate(2, superPositionActivated = $$props.superPositionActivated);
    		if ("superPositionColumns" in $$props) superPositionColumns = $$props.superPositionColumns;
    		if ("superPositionCount" in $$props) $$invalidate(3, superPositionCount = $$props.superPositionCount);
    		if ("activePlayerName" in $$props) $$invalidate(4, activePlayerName = $$props.activePlayerName);
    	};

    	return [
    		activeBoard,
    		winnerName,
    		superPositionActivated,
    		superPositionCount,
    		activePlayerName,
    		handlePlayerMove,
    		collapseForPlayer,
    		superPositionColumns,
    		PLAYER1,
    		PLAYER2,
    		gameBoard,
    		switchActivePlayer,
    		handleSuperPosition,
    		canProceed,
    		computeCollapse,
    		click_handler,
    		click_handler_1
    	];
    }

    class Frame extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Frame",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.16.4 */
    const file$1 = "src/App.svelte";

    // (42:4) {:catch error}
    function create_catch_block(ctx) {
    	let p;
    	let t_value = /*error*/ ctx[3].message + "";
    	let t;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(t_value);
    			set_style(p, "color", "red");
    			add_location(p, file$1, 42, 6, 969);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(42:4) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (31:4) {:then hello}
    function create_then_block(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$1, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$playing*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "class", "row flex flex-center ");
    			add_location(div, file$1, 31, 6, 712);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(31:4) {:then hello}",
    		ctx
    	});

    	return block;
    }

    // (35:8) {:else}
    function create_else_block$1(ctx) {
    	let div;
    	let h1;
    	let t0_value = /*hello*/ ctx[2] + "";
    	let t0;
    	let t1;
    	let current;
    	const menu = new Frame({ $$inline: true });

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			t0 = text(t0_value);
    			t1 = space();
    			create_component(menu.$$.fragment);
    			add_location(h1, file$1, 36, 12, 864);
    			attr_dev(div, "class", "row flex flex-center");
    			add_location(div, file$1, 35, 10, 817);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			append_dev(h1, t0);
    			insert_dev(target, t1, anchor);
    			mount_component(menu, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(menu.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(menu.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			destroy_component(menu, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(35:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (33:8) {#if $playing}
    function create_if_block$1(ctx) {
    	let current;
    	const frame = new Frame({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(frame.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(frame, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(frame.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(frame.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(frame, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(33:8) {#if $playing}",
    		ctx
    	});

    	return block;
    }

    // (27:21)        <div class="row flex flex-center">         <h1>Loading...</h1>       </div>     {:then hello}
    function create_pending_block(ctx) {
    	let div;
    	let h1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Loading...";
    			add_location(h1, file$1, 28, 8, 655);
    			attr_dev(div, "class", "row flex flex-center");
    			add_location(div, file$1, 27, 6, 612);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(27:21)        <div class=\\\"row flex flex-center\\\">         <h1>Loading...</h1>       </div>     {:then hello}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let div;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 2,
    		error: 3,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*sayHello*/ ctx[0], info);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			info.block.c();
    			attr_dev(div, "class", "row flex flex-center ");
    			add_location(div, file$1, 25, 2, 548);
    			attr_dev(main, "class", "svelte-13cscpr");
    			add_location(main, file$1, 24, 0, 539);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			info.block.m(div, info.anchor = null);
    			info.mount = () => div;
    			info.anchor = null;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			{
    				const child_ctx = ctx.slice();
    				child_ctx[2] = info.resolved;
    				info.block.p(child_ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			info.block.d();
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const BACKEND_URL$1 = "http://localhost:3000/api";

    function instance$1($$self, $$props, $$invalidate) {
    	let $playing;
    	validate_store(playing, "playing");
    	component_subscribe($$self, playing, $$value => $$invalidate(1, $playing = $$value));
    	const sayHello = fetch(`${BACKEND_URL$1}`).then(r => r.text());

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ("$playing" in $$props) playing.set($playing = $$props.$playing);
    	};

    	return [sayHello, $playing];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { sayHello: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get sayHello() {
    		return this.$$.ctx[0];
    	}

    	set sayHello(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
