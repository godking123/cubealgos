#ifndef F2L_ALGOS_H
#define F2L_ALGOS_H

#include <string>

struct F2LAlgos {
    std::string name;
    std::string moves;
};

const F2LAlgos ALGS[] = {
    {"corner URF D up, edge UR",                     "R U2 R' U' R U R'"},
    {"corner URF D right, edge UR",                  "U' R U' R' U R U R'"},
    {"corner URF D front, edge UR",                  "U R U' R'"},
    {"corner URF D up, edge UB",                     "U R U2 R' U R U' R'"},
    {"corner URF D right, edge UB",                  "R U R'"},
    {"corner URF D front, edge UB",                  "U' R U R' U2 R U' R'"},
    {"corner URF D up, edge UL",                     "U2 R U R' U R U' R'"},
    {"corner URF D right, edge UL",                  "U' R U R' U R U R'"},
    {"corner URF D front, edge UL",                  "U' R U2 R' U2 R U' R'"},
    {"corner URF D up, edge UF",                     "U R U' R' U' R U' R' U R U' R'"},
    {"corner URF D right, edge UF",                  "R' U2 R2 U R2 U R"},
    {"corner URF D front, edge UF",                  "F' U F U2 R U R'"},
    {"corner in slot solved, edge UB",               "U' R' F R F' R U R'"},
    {"corner in slot D front, edge UB",              "R U' R' U R U' R'"},
    {"corner in slot D right, edge UB",              "R U R' U' R U R'"},
    {"corner URF D up, edge UR flipped",             "U' F' U F U F' U F U' F' U F"},
    {"corner URF D right, edge UR flipped",          "R U' R' U2 F' U' F"},
    {"corner URF D front, edge UR flipped",          "F U2 F2 U' F2 U' F'"},
    {"corner URF D up, edge UB flipped",             "U2 F' U' F U' F' U F"},
    {"corner URF D right, edge UB flipped",          "U F' U2 F U2 F' U F"},
    {"corner URF D front, edge UB flipped",          "U F' U' F U' F' U' F"},
    {"corner URF D up, edge UL flipped",             "U' F' U2 F U' F' U F"},
    {"corner URF D right, edge UL flipped",          "U F' U' F U2 F' U F"},
    {"corner URF D front, edge UL flipped",          "F' U' F"},
    {"corner URF D up, edge UF flipped",             "F' U2 F U F' U' F"},
    {"corner URF D right, edge UF flipped",          "U' F' U F"},
    {"corner URF D front, edge UF flipped",          "U F' U F U' F' U' F"},
    {"corner in slot solved, edge UB flipped",       "U F R' F' R F' U' F"},
    {"corner in slot D front, edge UB flipped",      "F' U' F U F' U' F"},
    {"corner in slot D right, edge UB flipped",      "F' U F U' F' U F"},
    {"corner URF D up, edge in slot",                "U R U' R' U R U' R' U R U' R'"},
    {"corner URF D right, edge in slot",             "U R U R' U2 R U R'"},
    {"corner URF D front, edge in slot",             "U' F' U' F U2 F' U' F"},
    {"corner in slot D front, edge in slot",         "R U' R' U' R U R' U2 R U' R'"},
    {"corner in slot D right, edge in slot",         "R U' R' U R U2 R' U R U' R'"},
    {"corner URF D up, edge in slot flipped",        "R U' R' F' U2 F"},
    {"corner URF D right, edge in slot flipped",     "U F' U' F U' R U R'"},
    {"corner URF D front, edge in slot flipped",     "U' R U R' U F' U' F"},
    {"corner in slot solved, edge in slot flipped",  "R2 U2 F R2 F' U2 R' U R'"},
    {"corner in slot D front, edge in slot flipped", "F' U F R B U2 B' R'"},
    {"corner in slot D right, edge in slot flipped", "R U' R' F' L' U2 L F"},
};

#endif // F2L_ALGOS_H
