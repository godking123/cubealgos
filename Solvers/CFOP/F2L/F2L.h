#ifndef F2L_H
#define F2L_H

#include <cstdint>
#include <vector>
#include "../../../CubeState/CubeState.h"

// One Pair Inserted
//
// extracted counts the other slots emptied first to free a stuck piece, 0 when the
// pair was a table case as it stood. searched is true only when no alg fit and the
// moves came from the pair search
struct F2LPair {
    int slot;
    std::vector<Move> moves;
    int extracted = 0;
    bool searched = false;
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

    // Moves that empty the FR slot and touch nothing else below the U layer, one
    // R U R' or F' U' F trigger per U angle. Seen from a slot's own side they empty
    // that slot instead
    const std::vector<std::vector<Move>>& extracts();

    // How to insert the slot's pair, no moves if it is already home
    // The alg for the case when the table has one. A piece stuck in another slot is
    // lifted out with that slot's shortest extract first, then the alg. Either way the
    // cross and every pair outside the emptied slots are kept. Only if no alg fits, a
    // search that keeps the cross and the placed pairs
    F2LPair planPair(const CubeState& s, int slot, int placed);
    std::vector<Move> solvePair(const CubeState& s, int slot, int placed);

    // Each round inserts a pair that is a table case as it stands when there is one,
    // the cheapest such, and otherwise the cheapest pair after extraction
    std::vector<F2LPair> solve(const CubeState& s);

} // namespace F2L

#endif // F2L_H
