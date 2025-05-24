# Duckling IDE

## Overview

Duckling IDE is a lightweight, web-based SQL IDE designed for interacting with local DuckDB database files (`.db`). It provides a simple and clean interface for developers and data scientists to quickly connect to databases, manage connection configurations, write and execute SQL queries, and view results. The application is built using Python with the Flask web framework for the backend, and standard HTML, CSS, and JavaScript for the frontend. Query results are processed using Polars.

## Features

* **Connection Management:**
    * Save multiple DuckDB connection configurations (name, path to `.db` file, read-only status).
    * Set an active connection configuration.
    * Add, edit, and delete connection configurations through a modal interface.
    * Prompt to create a new `.db` file if it doesn't exist when adding a writable connection.
* **SQL Editor:**
    * A text area for writing and editing SQL queries.
    * **Highlight-to-Run:** Execute only the highlighted portion of a script. If no text is selected, the entire script is executed.
* **Query Execution:**
    * "Run Query" button to execute SQL against the currently connected database.
    * Explicit "Connect" and "Disconnect" buttons to manage the live database connection.
* **Results Display:**
    * Query results are displayed in a clear, tabular format.
    * Messages for successful DML/DDL operations, including rows affected.
    * Error messages from the database are shown.
* **Script Management:**
    * Load SQL scripts from local `.sql` or `.txt` files into the editor.
    * Save the content of the SQL editor to a local file.
* **User Interface:**
    * Clean, dark-themed interface.
    * Status bar indicating connection state and query outcomes.

## Technologies Used

* **Backend:**
    * Python 3
    * Flask (for the web server and API)
    * DuckDB (as the database engine)
    * Polars (for DataFrame manipulation before sending to frontend)
* **Frontend:**
    * HTML5
    * CSS3
    * JavaScript (Vanilla JS for DOM manipulation and API calls)
* **Configuration:**
    * `json` (for storing connection configurations)

## Project Structure
```text
duckling_flask/
├── app.py                 # Main Flask application, API routes, DB logic
├── duckling_config.json   # Stores connection configurations (created on first run)
├── static/
│   ├── css/
│   │   └── style.css      # Stylesheets for the application
│   ├── js/
│   │   └── main.js        # Client-side JavaScript for interactivity
│   └── images/
│       └── logo.svg       # Application logo (or .png)
└── templates/
    └── index.html         # Main HTML page for the IDE
```

## Setup and Installation

1.  **Prerequisites:**
    * Python 3.7+
    * `pip` (Python package installer)

2.  **Clone the Repository (if applicable):**
    ```bash
    git clone <your-repository-url>
    cd duckling_flask
    ```

3.  **Create a Virtual Environment (Recommended):**
    ```bash
    python -m venv venv
    # On Windows
    venv\Scripts\activate
    # On macOS/Linux
    source venv/bin/activate
    ```

4.  **Install Dependencies:**
    ```bash
    pip install Flask duckdb polars
    ```

## How to Run

1.  Navigate to the project directory (`duckling_flask/`) in your terminal.
2.  Ensure your virtual environment is activated (if you created one).
3.  Run the Flask application:
    ```bash
    python app.py
    ```
4.  Open your web browser and go to: `http://127.0.0.1:5001` (or the URL shown in the terminal).

Upon first run, a `duckling_config.json` file and a `default_duckling.db` database file will be created in the project directory if they don't already exist.

## Usage

1.  **Manage Configurations:**
    * Click "Manage Configs" to open the connection configuration modal.
    * Add a new configuration by filling in the Name, Path to your `.db` file, and selecting Read-Only if desired. Click "Save Configuration".
    * To edit, select an existing configuration from the list, modify its details, and click "Save Configuration".
    * To delete, select a configuration and click "Delete Selected".
    * The dropdown in the main UI shows the "Active Config". Change this by selecting a different configuration from the dropdown.
2.  **Connect to a Database:**
    * Ensure an "Active Config" is selected.
    * Click the "Connect to [Config Name]" button. The status bar will update to show the connected database.
3.  **Write & Execute SQL:**
    * Type your SQL query into the editor.
    * To execute only a part of the script, highlight that part with your mouse.
    * Click "▶ Run Query". Results or messages will appear below.
4.  **Load/Save Scripts:**
    * Click "Load SQL" to open a file dialog and load a script into the editor.
    * Click "Save SQL" to download the current editor content as a `.sql` file.
5.  **Disconnect:**
    * Click the "Disconnect from [DB Name]" button to close the current database connection.

## Future Enhancements

* Syntax highlighting in the SQL editor.
* Packaging the application as a standalone executable (e.g., using PyInstaller and pywebview).
* More advanced results table features (sorting, filtering on the frontend).
* Schema browser/explorer panel.
* User authentication and cloud storage for configurations/scripts (for a non-local version).
* tabs for multiple scripts.

---
*This README provides a general guide. Specific paths or commands might need adjustment based on your OS or project setup.*

