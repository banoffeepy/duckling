from flask import Flask, render_template, request, jsonify
import duckdb
import polars as pl
import json
import os
import traceback

app = Flask(__name__)

APP_NAME = "Duckling"
APP_VERSION = "0.1.0"
CONFIG_FILE = 'duckling_config.json'

# Polars display settings
pl.Config.set_tbl_rows(30)
pl.Config.set_tbl_cols(20)
pl.Config.set_fmt_str_lengths(80)
pl.Config.set_tbl_width_chars(500)

# --- Global State ---
current_db_conn = None
connected_db_details = {}


#
# Loads application configuration from JSON file.
# Creates a default configuration and database if none exists.
#
def load_config():
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            "connections": [{"name": "Default Duckling DB", "path": "default_duckling.db", "read_only": False}],
            "active_connection_name": "Default Duckling DB"
        }
        save_config(default_config)
        default_db_path = default_config["connections"][0]["path"]
        if not os.path.exists(default_db_path):
            try:
                db_dir = os.path.dirname(default_db_path)
                if db_dir and not os.path.exists(db_dir):
                    os.makedirs(db_dir, exist_ok=True)
                conn_test = duckdb.connect(default_db_path, read_only=False)
                conn_test.close()
                print(f"Default database {default_db_path} created.")
            except Exception as e:
                print(f"Warning: Could not create default database {default_db_path}: {e}")
        return default_config
    try:
        with open(CONFIG_FILE, 'r') as f:
            config = json.load(f)
            if "connections" not in config or "active_connection_name" not in config:
                raise ValueError("Config file is missing essential keys.")
            return config
    except (IOError, json.JSONDecodeError, ValueError) as e:
        print(f"Error loading config: {e}. Reverting to default.")
        default_config = {
            "connections": [{"name": "Fallback DB", "path": "fallback_duckling.db", "read_only": False}],
            "active_connection_name": "Fallback DB"
        }
        save_config(default_config)
        return default_config



#
# Saves the given configuration data to the JSON file.
#
def save_config(config_data):
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config_data, f, indent=4)
    except IOError as e:
        print(f"Error saving config: {e}")



#
# Retrieves connection details for a given connection name from the configuration.
#
def get_connection_details_by_name(config, name):
    if not name:
        return None
    for conn_details in config.get("connections", []):
        if conn_details["name"] == name:
            return conn_details
    return None



#
# Establishes a DuckDB connection based on provided details.
# Manages global connection state.
#
def internal_connect_db(conn_details_to_connect):
    global current_db_conn, connected_db_details
    
    if not conn_details_to_connect:
        return False, "No connection details provided."

    internal_disconnect_db(silent=True) # Ensure any previous connection is closed

    db_path = conn_details_to_connect["path"]
    read_only = conn_details_to_connect["read_only"]

    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except OSError as e:
            return False, f"Error creating directory {db_dir}: {e}"

    if not os.path.exists(db_path):
        if read_only:
            return False, f"Read-only connection, but file '{db_path}' not found."
        print(f"Database file {db_path} does not exist. DuckDB will attempt to create it.")
    
    try:
        current_db_conn = duckdb.connect(database=db_path, read_only=read_only)
        connected_db_details = conn_details_to_connect
        print(f"Successfully connected to: {connected_db_details['name']} ({db_path})")
        return True, f"Connected to {connected_db_details['name']}"
    except Exception as e:
        current_db_conn = None
        connected_db_details = {}
        print(f"Failed to connect to {conn_details_to_connect['name']}: {e}")
        return False, str(e)



#
# Closes the current global DuckDB connection if one exists.
#
def internal_disconnect_db(silent=False):
    global current_db_conn, connected_db_details
    if current_db_conn:
        try:
            current_db_conn.close()
            if not silent:
                print(f"Disconnected from {connected_db_details.get('name', 'Unknown DB')}")
        except Exception as e:
            if not silent:
                print(f"Error disconnecting: {e}")
        finally:
            current_db_conn = None
            connected_db_details = {}
            return True, "Disconnected successfully."
    return False, "Was not connected."



#
# Serves the main application page.
#
@app.route('/')
def index():
    return render_template('index.html', app_name=APP_NAME, app_version=APP_VERSION)



#
# API endpoint to get the current connection status and active configuration.
#
@app.route('/api/status', methods=['GET'])
def get_status():
    config = load_config()
    active_config_name = config.get("active_connection_name")
    active_config_details = get_connection_details_by_name(config, active_config_name)
    
    if current_db_conn and connected_db_details:
        return jsonify({
            "is_connected": True,
            "connected_db_name": connected_db_details.get("name"),
            "connected_db_path": connected_db_details.get("path"),
            "connected_db_read_only": connected_db_details.get("read_only"),
            "active_config_name": active_config_name,
            "active_config_details": active_config_details
        })
    else:
        return jsonify({
            "is_connected": False,
            "active_config_name": active_config_name,
            "active_config_details": active_config_details
        })



#
# API endpoint to connect to the currently configured active database.
#
@app.route('/api/connect', methods=['POST'])
def connect_active_db_route():
    config = load_config()
    active_name = config.get("active_connection_name")
    if not active_name:
        return jsonify({"error": "No active connection configured."}), 400
    
    conn_details_to_connect = get_connection_details_by_name(config, active_name)
    if not conn_details_to_connect:
        return jsonify({"error": f"Details for active connection '{active_name}' not found."}), 404

    success, message = internal_connect_db(conn_details_to_connect)
    if success:
        return jsonify({"message": message, "connected_db_name": conn_details_to_connect.get("name")})
    else:
        return jsonify({"error": message}), 500



#
# API endpoint to disconnect the current database connection.
#
@app.route('/api/disconnect', methods=['POST'])
def disconnect_db_route():
    success, message = internal_disconnect_db()
    if success:
        return jsonify({"message": message})
    else:
        return jsonify({"message": "Not connected or already disconnected."})



#
# API endpoint to retrieve the list of saved connection configurations.
#
@app.route('/api/connections', methods=['GET'])
def get_connections_list():
    config = load_config()
    return jsonify({
        "connections": config.get("connections", []),
        "active_connection_name": config.get("active_connection_name")
    })



#
# API endpoint to set the active connection configuration.
# Does not establish the connection; that's done via /api/connect.
#
@app.route('/api/connections/set-active', methods=['POST'])
def set_active_connection_config():
    data = request.json
    name_to_set_active = data.get('name')
    if not name_to_set_active:
        return jsonify({"error": "Connection name not provided"}), 400

    config = load_config()
    found = any(conn['name'] == name_to_set_active for conn in config.get('connections', []))
    if not found:
        return jsonify({"error": f"Connection '{name_to_set_active}' not found in configurations."}), 404
    
    if current_db_conn and connected_db_details.get("name") != name_to_set_active:
        internal_disconnect_db()
        print(f"Disconnected from previous DB as active configuration changed to '{name_to_set_active}'.")

    config['active_connection_name'] = name_to_set_active
    save_config(config)
    
    return jsonify({"message": f"Active configuration set to '{name_to_set_active}'. Please click 'Connect' to establish connection."})



#
# API endpoint to save a new or edited connection configuration.
# Handles database file creation confirmation.
#
@app.route('/api/connections/save', methods=['POST'])
def save_new_or_edit_connection():
    data = request.json
    name = data.get('name', '').strip()
    path = data.get('path', '').strip()
    read_only = data.get('read_only', False)
    original_name = data.get('original_name')
    confirm_create = data.get('confirm_create', False)

    if not name or not path:
        return jsonify({"error": "Name and Path are required"}), 400

    config = load_config()
    connections = config.get("connections", [])
    
    db_dir = os.path.dirname(path)
    if db_dir and not os.path.exists(db_dir):
        try:
            os.makedirs(db_dir, exist_ok=True)
        except OSError as e:
            return jsonify({"error": f"Could not create directory for database: {str(e)}"}), 500

    if not os.path.exists(path) and not read_only and not confirm_create:
        return jsonify({
            "requires_confirmation": True,
            "message": f"Database file '{path}' does not exist. Create it?"
        }), 200

    if confirm_create and not os.path.exists(path) and not read_only:
        try:
            conn_test = duckdb.connect(database=path, read_only=False)
            conn_test.close()
            print(f"Database file '{path}' created upon confirmation.")
        except Exception as e:
            return jsonify({"error": f"Could not create database file '{path}': {str(e)}"}), 500
    elif not os.path.exists(path) and read_only:
        return jsonify({"error": f"Read-only connection specified, but database file '{path}' does not exist."}), 400

    if original_name: 
        found_original = False
        for i, conn in enumerate(connections):
            if conn['name'] == original_name:
                if name != original_name and any(c['name'] == name for idx, c in enumerate(connections) if idx != i):
                    return jsonify({"error": f"Another connection with name '{name}' already exists."}), 400
                
                connections[i] = {"name": name, "path": path, "read_only": read_only}
                found_original = True
                
                if config.get("active_connection_name") == original_name:
                    config["active_connection_name"] = name
                
                if current_db_conn and connected_db_details.get("name") == original_name:
                    internal_disconnect_db()
                    print(f"Disconnected from '{original_name}' as its configuration was updated.")
                break
        if not found_original:
            return jsonify({"error": f"Connection '{original_name}' not found for editing."}), 404
        message = f"Connection '{name}' updated."
    else: 
        if any(conn['name'] == name for conn in connections):
            return jsonify({"error": f"Connection name '{name}' already exists."}), 400
        connections.append({"name": name, "path": path, "read_only": read_only})
        if len(connections) == 1 and not config.get("active_connection_name"):
            config["active_connection_name"] = name
        message = f"Connection '{name}' added."

    config["connections"] = connections
    save_config(config)
    return jsonify({"message": message})



#
# API endpoint to delete a connection configuration.
#
@app.route('/api/connections/delete', methods=['POST'])
def delete_connection_route():
    data = request.json
    name_to_delete = data.get('name')
    if not name_to_delete:
        return jsonify({"error": "Connection name not provided"}), 400

    config = load_config()
    connections = config.get("connections", [])
    original_len = len(connections)
    connections = [conn for conn in connections if conn['name'] != name_to_delete]

    if len(connections) == original_len:
        return jsonify({"error": f"Connection '{name_to_delete}' not found."}), 404

    config['connections'] = connections
    
    if current_db_conn and connected_db_details.get("name") == name_to_delete:
        internal_disconnect_db()

    if config.get('active_connection_name') == name_to_delete:
        config['active_connection_name'] = connections[0]['name'] if connections else None
    
    save_config(config)
    return jsonify({"message": f"Connection '{name_to_delete}' deleted."})



#
# API endpoint to execute an SQL query against the connected database.
#
@app.route('/api/query', methods=['POST'])
def execute_query():
    if not current_db_conn:
        return jsonify({"error": "Not connected to any database. Please connect first."}), 400
    
    data = request.json
    query = data.get('query')
    if not query:
        return jsonify({"error": "Query is empty"}), 400

    print(f"Received SQL Query for execution: {query}") 

    try:
        result_relation = current_db_conn.execute(query)
        
        if result_relation:
            df = result_relation.pl() 
            # print(f"DEBUG: Type of df object is: {type(df)}") 

            if df is not None:
                if df.height == 0 and df.width == 0 and not result_relation.description:
                    try:
                        rows_affected_df = current_db_conn.execute("SELECT changes() as row_count;").pl()
                        rows_affected = rows_affected_df.item(0,0) if rows_affected_df is not None and rows_affected_df.height > 0 else 0
                        return jsonify({
                            "message": f"Query executed successfully. Rows affected: {rows_affected}",
                            "rows_affected": rows_affected,
                            "data_type": "message"
                        })
                    except Exception as change_ex:
                        # print(f"Could not get 'changes()': {change_ex}")
                        return jsonify({"message": "Query executed successfully (no data returned or 0 rows affected).", "data_type": "message"})
                else: 
                    if df.is_empty():
                        return jsonify({
                            "message": "Query returned no data.",
                            "columns": df.columns,
                            "data": [],
                            "rows_affected": 0,
                            "data_type": "table"
                        })
                    else:
                        table_data_dicts = df.to_dicts()
                        return jsonify({
                            "columns": df.columns,
                            "data": table_data_dicts,
                            "rows_affected": df.height,
                            "data_type": "table"
                        })
            else: 
                 return jsonify({"message": "Query executed, but result processing yielded no DataFrame.", "data_type": "message"})
        
        return jsonify({"message": "Query executed, but no specific result set was returned by the relation object.", "data_type": "message"}), 200

    except Exception as e:
        print(f"ERROR during query execution or processing: {type(e).__name__} - {e}")
        traceback.print_exc()
        return jsonify({"error": str(e), "data_type": "error"}), 400



if __name__ == '__main__':
    load_config() 
    app.run(debug=True, host='127.0.0.1', port=5001)
