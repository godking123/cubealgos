#include "CubeState/CubeAlgos.h"
#include "Solvers/Method.h"
#include "Scramblers/WCA.h"

#define RESET "\033[0m"
#define BOLD  "\033[1m"
#define GREEN "\033[32m"
#define CYAN  "\033[36m"
#define YELLOW "\033[33m"
#define RED   "\033[31m"

// Print the method list, marking the one in use and the ones not written yet
static void printMethods(int current) {
    for (int i = 0; i < METHOD_COUNT; i++) {
        std::cout << "  " << (i == current ? GREEN "*" RESET : " ")
                  << " " << (i + 1) << ") " << BOLD << METHODS[i].name << RESET
                  << " — " << METHODS[i].description;
        if (!METHODS[i].implemented)
            std::cout << YELLOW << " (not implemented)" << RESET;
        std::cout << "\n";
    }
}

// Read a method number, -1 if the user did not pick a new one
static int readMethod() {
    std::string input;
    std::cout << "Method number: ";
    if (!std::getline(std::cin, input)) return -1;

    int choice = 0;
    try {
        choice = std::stoi(input);
    } catch (const std::exception&) {
        std::cout << RED << "Not a number." << RESET << "\n\n";
        return -1;
    }
    if (choice < 1 || choice > METHOD_COUNT) {
        std::cout << RED << "No such method." << RESET << "\n\n";
        return -1;
    }
    if (!METHODS[choice - 1].implemented) {
        std::cout << YELLOW << METHODS[choice - 1].name
                  << " is not implemented yet." << RESET << "\n\n";
        return -1;
    }
    return choice - 1;
}

int main() {
    std::cout << BOLD << "Building tables..." << RESET << "\n";
    for (int i = 0; i < METHOD_COUNT; i++)
        METHODS[i].buildTables();
    std::cout << GREEN << "Ready.\n" << RESET << "\n";

    std::cout << BOLD
              << "Rubik's Cube Solver\n"
              << "───────────────────\n"
              << RESET;

    // Starting Method
    int method = 0;
    printMethods(-1);
    std::cout << "\n";
    int picked = readMethod();
    if (picked >= 0) method = picked;

    std::cout << "\nSolving with " << BOLD << METHODS[method].name << RESET << ".\n"
              << "Scramble with " << CYAN << orientationName(Orientation{}) << RESET << "\n"
              << "Press ENTER to generate a new scramble and solve it.\n"
              << "Type 'm' to change method, 'q' to quit.\n\n";

    std::string input;
    uint64_t seed = 42;

    while (true) {
        std::cout << "[ Press ENTER ] ";
        if (!std::getline(std::cin, input)) break;
        if (input == "q" || input == "Q") break;
        if (input == "m" || input == "M") {
            std::cout << "\n";
            printMethods(method);
            std::cout << "\n";
            picked = readMethod();
            if (picked >= 0) {
                method = picked;
                std::cout << "Now solving with " << BOLD << METHODS[method].name
                          << RESET << ".\n\n";
            }
            continue;
        }

        // Random State Scramble, as at Competition
        auto scrambleMoves = WCA::scramble(seed++);
        std::string scrambleStr = sequenceName(scrambleMoves);

        std::cout << "\n" << BOLD << CYAN
                  << "Scramble: " << RESET << scrambleStr << "\n";

        // Apply Scramble
        CubeState state = CubeState::solved();
        for (auto m : scrambleMoves)
            state = state.apply(m);

        // Solve With the Chosen Method
        std::cout << YELLOW << "Solving with " << METHODS[method].name
                  << "..." << RESET << "\n";

        // Methods With Stages Solve Once and Print Both Views
        std::vector<Stage> stages;
        std::vector<Move> solution;
        auto start = std::chrono::high_resolution_clock::now();
        if (METHODS[method].stages) {
            stages = METHODS[method].stages(state);
            for (const Stage& stage : stages)
                solution.insert(solution.end(), stage.moves.begin(), stage.moves.end());
        } else {
            solution = METHODS[method].solve(state);
        }
        auto end   = std::chrono::high_resolution_clock::now();

        double ms = std::chrono::duration<double, std::milli>(end - start).count();

        // Replay the whole solution, so the check covers the printed sequence
        // rather than an intermediate state
        CubeState check = state;
        for (auto m : solution)
            check = check.apply(m);

        bool solved = check.isSolved();

        // Print Result
        std::cout << BOLD << GREEN
                  << "Method:   " << RESET << METHODS[method].name << "\n";
        std::cout << BOLD << GREEN
                  << "Solution: " << RESET
                  << sequenceName(solution) << "\n";
        for (const Stage& stage : stages)
            std::cout << "  " << BOLD << stage.name << ":" << RESET
                      << std::string(7 - stage.name.size(), ' ')
                      << sequenceName(stage.moves) << "  (" << stage.moves.size() << ")\n";

        std::cout << BOLD << "Moves:    " << RESET << solution.size() << "\n";
        std::cout << BOLD << "Time:     " << RESET << ms << " ms\n";
        std::cout << BOLD << "Solved:   " << RESET
                  << (solved ? GREEN "YES" : RED "NO") << RESET << "\n\n";
    }

    std::cout << "Bye.\n";
    return 0;
}
