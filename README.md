<img src="docs/assets/logo.svg" alt="cubealgos" width="140"> 

# cubealgos

`cubealgos` is a Rubik's Cube solver written in C++. It generates WCA random-state
scrambles and solves them with a choice of methods.

[![C++](https://img.shields.io/badge/C%2B%2B-17-blue?style=flat)](#build)
[![license](https://img.shields.io/badge/license-MIT-green?style=flat)](LICENSE)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat)](#build)

## Build

Needs a C++17 compiler and `make`.

```sh
make              # builds ./cubealgo and ./tests
make test         # runs the test suite
```

## Run

```sh
./cubealgo
```

Pick a method, then press ENTER for a WCA random-state scramble and its solution.
`m` changes method, `q` quits.

## Simulator

<img src="docs/assets/simulator.png" alt="cubealgos simulator" width="100%">

```sh
make simulator
./simulator       # then open http://localhost:8080
```

A browser front end for the engine: Space scrambles the cube, Space again loads the
CFOP or Kociemba solution, and the arrow keys step through it while Space plays it.
Drag to orbit, turn the cube by hand with the keypad or a typed sequence, and type
`help` in the command box for the rest.

## License

MIT
