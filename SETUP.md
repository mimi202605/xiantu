# Project Setup & Agent Framework

This project tracks sensitive configuration and agent workflows in **local folders** that are **gitignored** from the main repository. These folders are backed up to a separate **private repository** via a sync script.

## Quick Start (New Machine)

1.  **Clone Main Repository**

    ```bash
    git clone <main-repo-url> ming
    cd ming
    ```

2.  **Clone Private Repository**
    Clone the private repo into a `private/` folder.

    ```bash
    git clone https://github.com/michael2221807/ming_private.git private
    ```

3.  **Restore Agent Data**
    Copy the data from `private/` to your project root.
    ```cmd
    xcopy private\.agent .agent /E /I
    xcopy private\.cursor .cursor /E /I
    xcopy private\docs docs /E /I
    xcopy private\testing_gamedata testing_gamedata /E /I
    ```

## Development Workflow

- **Work Locally**: Code and configure agents in `.agent/`.
- **Sync to Private**: When you make changes to workflows or docs, run:
  ```cmd
  .agent\scripts\sync-to-private.bat
  ```
  This will copy your changes to `private/`, commit, and push them.
