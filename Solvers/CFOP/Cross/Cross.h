#ifndef CROSS_H
#define CROSS_H

#include <cstdint>
#include <vector>
#include "../../../CubeState/CubeState.h"
#include "../../../CubeState/Rotation.h"

// The shortest cross over all six colours
// hold is how to turn the cube before executing moves, moves are in that frame
struct CrossResult {
    int color;
    Orientation hold;
    std::vector<Move> moves;
};

namespace Cross {
    const uint16_t EDGES = 0xF0;  // DR DF DL DB, Pieces 4 to 7

    bool isSolved(const CubeState& s);
    std::vector<Move> solveCross(const CubeState& s);
    CrossResult bestCross(const CubeState& scrambled);
}

#endif // CROSS_H
