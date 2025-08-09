# Contributing to the Project

First off, thank you for considering contributing to this project! Your help is greatly appreciated.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please make sure to:

1.  **Check existing issues:** See if the bug has already been reported.
2.  **Open a new issue:** If not, please open a new issue. Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

If you have an idea for an enhancement, please open an issue with a clear title and description of the enhancement you would like to see.

### Pull Requests

1.  **Fork the repo** and create your branch from `master`.
2.  **Set up the development environment:** This is a monorepo using Yarn Workspaces. Run `yarn install` at the root of the project to install all dependencies.
3.  **Make your changes.**
4.  **Ensure the test suite passes:** Run `yarn test` in the specific workspace you are working on (e.g., `cd phantom-api-backend && yarn test`). To run all tests for the entire project, you can use a command like `yarn workspaces foreach run test`.
5.  **Submit a pull request** to the `main` branch.

Please note that this project follows a **code of conduct**. Please be respectful in all your interactions.