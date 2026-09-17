#ifndef PLL_ALGOS_H
#define PLL_ALGOS_H

#include <string>

// One Alg per Case
// Face turns only, slice moves rewritten so the parser takes them
struct PLLAlgo {
    std::string name;
    std::string moves;
};

const PLLAlgo PLL_ALGS[] = {
    {"Aa", "R' F R' B2 R F' R' B2 R2"},
    {"Ab", "R2 B2 R F R' B2 R F' R"},
    {"E",  "R B' R' F R B R' F' R B R' F R B' R' F'"},
    {"F",  "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R"},
    {"Ga", "R2 U R' U R' U' R U' R2 U' D R' U R D'"},
    {"Gb", "R' U' R U D' R2 U R' U R U' R U' R2 D"},
    {"Gc", "R2 U' R U' R U R' U R2 U D' R U' R' D"},
    {"Gd", "R U R' U' D R2 U' R U' R' U R' U R2 D'"},
    {"H",  "R2 U2 R U2 R2 U2 R2 U2 R U2 R2"},
    {"Ja", "L' U' L F L' U' L U L F' L2 U L"},
    {"Jb", "R U R' F' R U R' U' R' F R2 U' R'"},
    {"Na", "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'"},
    {"Nb", "R' U R U' R' F' U' F R U R' F R' F' R U' R"},
    {"Ra", "R U' R' U' R U R D R' U' R D' R' U2 R'"},
    {"Rb", "R' U2 R U2 R' F R U R' U' R' F' R2"},
    {"T",  "R U R' U' R' F R2 U' R' U' R U R' F'"},
    {"Ua", "R U' R U R U R U' R' U' R2"},
    {"Ub", "R2 U R U R' U' R' U' R' U R'"},
    {"V",  "R' U R' U' B' R' B2 U' B' U B' R B R"},
    {"Y",  "F R U' R' U' R U R' F' R U R' U' R' F R F'"},
    {"Z",  "R2 L2 D R2 L2 U R' L F2 R2 L2 B2 R' L"},
};

#endif // PLL_ALGOS_H
