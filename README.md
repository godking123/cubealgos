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

```sh
make simulator
./simulator       # then open http://localhost:8080
```

A browser front end for the engine. Space scrambles the cube move by move, with the
scramble shown along the top to apply to a real cube; Space again loads the CFOP (or
Kociemba) solution as a sequence on the right; the arrow keys step through it one move
at a time and Space plays it at the chosen tempo, with the camera easing round to any
face that is turned away. Drag to orbit, with momentum; left alone the cube drifts.
The cube is drawn in ink lines or as a modern pale-plastic body, in colour or dither
patterns. Turn it by hand with the keypad, the keyboard or a typed sequence; `help` in
the command box lists the rest.

## License

MIT
