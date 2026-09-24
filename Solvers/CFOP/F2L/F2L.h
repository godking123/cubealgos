#ifndef F2L_H
#define F2L_H

#include <cstdint>
#include <vector>
#include "../../../CubeState/CubeState.h"

// One Pair Inserted
struct F2LPair {
    int slot;
    std::vector<Move> moves;
};

// Slot i is corner 4+i with edge 8+i: DFR+FR, DLF+FL, DBL+BL, DRB+BR.
namespace F2L {
    const int SLOTS = 4;

    int corner(int slot);  // Piece Number of the Slot's Corner
    int edge(int slot);    // Piece Number of the Slot's Edge

    // Cross and All Four Pairs Home
    bool isSolved(const CubeState& s);

    // Case Table, Every FR Pair Case to the Alg That Inserts It
    void buildTables();
    int tableSize();

    // Moves that insert the slot's pair, nothing if it is already home
    // The alg for the case when the table has one, keeping the cross and every other
    // pair. Otherwise a search that keeps the cross and the placed pairs
    std::vector<Move> solvePair(const CubeState& s, int slot, int placed);

    // Each Round Inserts Current Cheapest Pair
    std::vector<F2LPair> solve(const CubeState& s);

} // namespace F2L

#endif // F2L_H
