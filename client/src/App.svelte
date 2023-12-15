<script>
  import { get } from "svelte/store";
  import { playing } from "./store/index.js";
  import Frame from "./component/Frame.svelte";
  import Menu from "./component/Frame.svelte";
  const BACKEND_URL = "<@BACKEND_URL@>";
  export const sayHello = fetch(`${BACKEND_URL}`).then(r => r.text());
</script>

<style>
  main {
    text-align: center;
    padding: 5rem;
  }
  p1 {
    font-weight: bold;
    border-radius: 20px;
    color: #000000;
    text-transform: uppercase;
    font-size: 3em;
    text-align: center;
  }
</style>

<main>
  <div class="row flex flex-center ">
    {#await sayHello}
      <div class="row flex flex-center">
        <h1>Loading...</h1>
      </div>
    {:then hello}
      <div class="row flex flex-center ">
        {#if $playing}
          <Frame />
        {:else}
          <div class="row flex flex-center">
            <h1>{hello}</h1>
          </div>
          <Menu />
        {/if}
      </div>
    {:catch error}
      <p style="color: red">{error.message}</p>
    {/await}
  </div>
</main>
