#include <iostream>
#include <string>
#include "../../CubeState/Scramble.h"
#include "../../CubeState/Rotation.h"
#include "../KociembaNaive/Kociemba.h"
#include "../../Scramblers/WCA.h"
#include "Cross/Cross.h"
#include "F2L/F2L.h"

// Interactive CFOP tester, Enter for the next scramble, q or EOF to quit
// Scrambles are WCA random state, so they need the solver's tables
int main() {
    Kociemba::buildTables();
    F2L::buildTables();
    std::cout << "Scramble with " << orientationName(Orientation{}) << "\n\n";
    std::string line;
    int n = 1;
    while (true) {
        auto scramble = WCA::scramble();
        CubeState cube = CubeState::solved();
        for (auto m : scramble) cube = cube.apply(m);

        CrossResult best = Cross::bestCross(cube);
        std::string rotation = rotationsTo(best.hold);

        std::cout << "Scramble " << n++ << ": " << sequenceName(scramble) << "\n"
                  << "Color:    " << colorName(best.color) << "\n"
                  << "Rotation: " << (rotation.empty() ? "(none)" : rotation) << "\n"
                  << "Hold:     " << orientationName(best.hold) << "\n"
                  << "Cross:    " << sequenceName(best.moves)
                  << "  (" << best.moves.size() << " moves)\n";

        // F2L Continues in the Cross Frame
        static const char* slotName[] = {"DFR", "DLF", "DBL", "DRB"};
        CubeState state = cube.rotate(best.hold);
        for (auto m : best.moves) state = state.apply(m);
        size_t f2lMoves = 0;
        for (const F2LPair& p : F2L::solve(state)) {
            std::cout << "Pair " << slotName[p.slot] << ": " << sequenceName(p.moves)
                      << "  (" << p.moves.size() << " moves)\n";
            f2lMoves += p.moves.size();
        }
        std::cout << "F2L:      " << f2lMoves << " moves, "
                  << best.moves.size() + f2lMoves << " with the cross\n";

        std::cout << "[Enter] next, q quit > " << std::flush;
        if (!std::getline(std::cin, line) || line == "q") break;
        std::cout << "\n";
    }
    return 0;
}
