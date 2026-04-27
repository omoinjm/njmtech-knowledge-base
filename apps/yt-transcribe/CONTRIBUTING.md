# Contributing to yt-transcribe

We welcome contributions to the `yt-transcribe` project! Whether it's bug reports, feature suggestions, or direct code contributions, your help is valuable.

Please read this guide to understand how you can best contribute.

## 🐛 Bug Reports

If you find a bug, please open an issue on the GitHub repository. When reporting a bug, please include:
*   A clear and concise description of the bug.
*   Steps to reproduce the behavior.
*   Expected behavior.
*   Actual behavior.
*   Your operating system and Go version.
*   Any relevant error messages or logs.

## ✨ Feature Suggestions

If you have an idea for a new feature or an enhancement, please open an issue to discuss it. Describe your idea clearly, explaining its benefits and potential use cases. This allows for discussion before you invest time in implementation.

## 💻 Code Contributions

We appreciate code contributions! To contribute code, please follow these steps:

1.  **Fork the repository** on GitHub.
2.  **Clone your forked repository** to your local machine.
    ```bash
    git clone https://github.com/your-username/yt-transcribe.git
    cd yt-transcribe
    ```
3.  **Create a new branch** for your feature or bug fix.
    ```bash
    git checkout -b feature/your-feature-name
    # or
    git checkout -b bugfix/issue-description
    ```
4.  **Set up your development environment:**
    *   Ensure you have Go (version 1.25.5 or newer) and `yt-dlp` installed and configured as described in the `README.md`.
    *   Build the project to ensure everything is working: `go build -o yt-transcribe`
5.  **Make your changes.** Adhere to the existing code style and structure.
    *   **Go Formatting:** Ensure your code is formatted with `go fmt`.
    *   **Linting:** Run `go vet ./...` to catch common mistakes.
    *   **Comments:** Add comments where necessary to explain complex logic or design decisions.
    *   **Tests:** If applicable, add unit tests for new functionality or bug fixes.
6.  **Test your changes.** Run the tool locally with your changes to confirm they work as expected.
7.  **Commit your changes** with a clear and concise commit message.
    ```bash
    git commit -m "feat: Add new feature (brief description)"
    # or
    git commit -m "fix: Resolve bug (issue description)"
    ```
8.  **Push your branch** to your forked repository on GitHub.
    ```bash
    git push origin feature/your-feature-name
    ```
9.  **Open a Pull Request (PR)** from your branch to the `main` branch of the upstream repository.
    *   Provide a clear title and description for your PR.
    *   Reference any related issues (e.g., "Closes #123").
    *   Be prepared to discuss your changes and address any feedback during the review process.

## 🚨 Code of Conduct

We expect all contributors to adhere to a respectful and inclusive code of conduct.
(You may consider linking to a separate `CODE_OF_CONDUCT.md` if the project grows, or state general expectations here.)

Thank you for contributing!
