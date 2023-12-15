import os
from numbers import Number
from flask import Flask, request, jsonify, abort, send_file
from flask_cors import CORS
import qiskit
from qiskit import Aer
from qiskit import QuantumCircuit, ClassicalRegister, QuantumRegister
from qiskit import execute
import random
def randum():
    return random.randint(0,1)
def board_collapse_string(n) :
  circ = QuantumCircuit(n, n)
  
  for i in range(n) :
    circ.h(i)
  
  circ.measure(range(n), range(n))
  
  backend = Aer.get_backend('qasm_simulator')
  job = execute(circ,backend, shots=1, memory=True)
  result = job.result()
  result_string = result.get_memory(circ)
  
  return result_string[0]
app = Flask(__name__, static_folder=os.environ.get('STATIC', "static"))
CORS(app)
@app.route('/')
def route_root():
    index_path = os.path.join(app.static_folder, 'index.html')
    return send_file(index_path)


@app.route('/<path:path>')
def route_frontend(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.isfile(file_path):
        return send_file(file_path)
    else:
        index_path = os.path.join(app.static_folder, 'index.html')
        return send_file(index_path)


@app.route("/api")
def helloQuantum():
    return "Welcome to Quantum in Row"


@app.route("/api/collapse", methods=["POST"])
def collapse():
    req = request.get_json(silent=True)
    print("received: ", req) 

    num_super_pos = req["super_positions"]
    if num_super_pos == 0 or not isinstance(num_super_pos, Number):
        return abort(400)
    s = board_collapse_string(num_super_pos)
    return jsonify({"res": s})


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 3000), debug=True)
