#ifndef OLL_ALGOS_H
#define OLL_ALGOS_H

#include <string>

// One Alg per Case, Speedsolving Numbering
// Face turns only, wide and slice moves rewritten so the parser takes them
struct OLLAlgo {
    std::string name;
    std::string moves;
};

const OLLAlgo OLL_ALGS[] = {
    {"OLL 1",  "R U2 R2 F R F' U2 R' F R F'"},
    {"OLL 2",  "F R U R' U' F' B U L U' L' B'"},
    {"OLL 3",  "B U L U' L' B' U' F R U R' U' F'"},
    {"OLL 4",  "B U L U' L' B' U F R U R' U' F'"},
    {"OLL 5",  "L' B2 R B R' B L"},
    {"OLL 6",  "L F2 R' F' R F' L'"},
    {"OLL 7",  "L F R' F R F2 L'"},
    {"OLL 8",  "R' F' L F' L' F2 R"},
    {"OLL 9",  "R U R' U' R' F R2 U R' U' F'"},
    {"OLL 10", "R U R' U R' F R F' R U2 R'"},
    {"OLL 11", "L F R' F R' D R D' R F2 L'"},
    {"OLL 12", "F R U R' U' F' U F R U R' U' F'"},
    {"OLL 13", "F U R U' R2 F' R U R U' R'"},
    {"OLL 14", "R' F R U R' F' R F U' F'"},
    {"OLL 15", "L' B' L R' U' R U L' B L"},
    {"OLL 16", "L F L' R U R' U' L F' L'"},
    {"OLL 17", "R U R' U R' F R F' U2 R' F R F'"},
    {"OLL 18", "L F R' F R F2 L2 B' R B' R' B2 L"},
    {"OLL 19", "L' R B R B R' B' R' L R' F R F'"},
    {"OLL 20", "L F R' F' R2 L2 B R B' R' B' R' L"},
    {"OLL 21", "R U2 R' U' R U R' U' R U' R'"},
    {"OLL 22", "R U2 R2 U' R2 U' R2 U2 R"},
    {"OLL 23", "R2 D R' U2 R D' R' U2 R'"},
    {"OLL 24", "L F R' F' L' F R F'"},
    {"OLL 25", "F' L F R' F' L' F R"},
    {"OLL 26", "R U2 R' U' R U' R'"},
    {"OLL 27", "R U R' U R U2 R'"},
    {"OLL 28", "L F R' F' L' R U R U' R'"},
    {"OLL 29", "R U R' U' R U' R' F' U' F R U R'"},
    {"OLL 30", "F R' F R2 U' R' U' R U R' F2"},
    {"OLL 31", "R' U' F U R U' R' F' R"},
    {"OLL 32", "R U B' U' R' U R B R'"},
    {"OLL 33", "R U R' U' R' F R F'"},
    {"OLL 34", "R U R2 U' R' F R U R U' F'"},
    {"OLL 35", "R U2 R2 F R F' R U2 R'"},
    {"OLL 36", "L' U' L U' L' U L U L F' L' F"},
    {"OLL 37", "F R' F' R U R U' R'"},
    {"OLL 38", "R U R' U R U' R' U' R' F R F'"},
    {"OLL 39", "L F' L' U' L U F U' L'"},
    {"OLL 40", "R' F R U R' U' F' U R"},
    {"OLL 41", "R U R' U R U2 R' F R U R' U' F'"},
    {"OLL 42", "R' U' R U' R' U2 R F R U R' U' F'"},
    {"OLL 43", "F' U' L' U L F"},
    {"OLL 44", "F U R U' R' F'"},
    {"OLL 45", "F R U R' U' F'"},
    {"OLL 46", "R' U' R' F R F' U R"},
    {"OLL 47", "R' U' R' F R F' R' F R F' U R"},
    {"OLL 48", "F R U R' U' R U R' U' F'"},
    {"OLL 49", "L F' L2 B L2 F L2 B' L"},
    {"OLL 50", "L' B L2 F' L2 B' L2 F L'"},
    {"OLL 51", "F U R U' R' U R U' R' F'"},
    {"OLL 52", "R U R' U R U' B U' B' R'"},
    {"OLL 53", "L' B' R B' R' B R B' R' B2 L"},
    {"OLL 54", "L F R' F R F' R' F R F2 L'"},
    {"OLL 55", "R U2 R2 U' R U' R' U2 F R F'"},
    {"OLL 56", "L F L' U R U' R' U R U' R' L F' L'"},
    {"OLL 57", "R U R' U' R' L F R F' L'"},
};

#endif // OLL_ALGOS_H
