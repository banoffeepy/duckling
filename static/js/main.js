// static/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const connectionSelect = document.getElementById('connection-select');
    const manageConnectionsBtn = document.getElementById('manage-connections-btn');
    const connectDisconnectBtn = document.getElementById('connect-disconnect-btn');
    const runQueryBtn = document.getElementById('run-query-btn');
    const sqlEditor = document.getElementById('sql-editor');
    const resultsOutput = document.getElementById('results-output');
    const statusBarMessage = document.getElementById('status-message');
    const loadSqlFileActual = document.getElementById('load-sql-file-actual');
    const saveSqlBtn = document.getElementById('save-sql-btn');

    const appInfoBtn = document.getElementById('app-info-btn');
    const appInfoModal = document.getElementById('appInfoModal');
    const closeAppInfoModalBtn = document.getElementById('close-app-info-modal');
    const okAppInfoModalBtn = document.getElementById('ok-app-info-modal-btn');

    const connectionsModal = document.getElementById('connectionsModal');
    const closeConnectionsModalBtn = document.getElementById('close-connections-modal');
    const modalConnectionList = document.getElementById('modal-connection-list');
    const connNameInput = document.getElementById('conn-name');
    const connPathInput = document.getElementById('conn-path');
    const connReadonlyInput = document.getElementById('conn-readonly');
    const saveConnBtn = document.getElementById('save-conn-btn');
    const newConnBtn = document.getElementById('new-conn-btn');
    const deleteConnBtn = document.getElementById('delete-conn-btn');
    const modalFormTitle = document.getElementById('modal-form-title');
    
    let editingConnectionName = null; 
    let currentConnectionsCache = []; 

    // Fetches current backend status and updates UI elements accordingly.
    async function fetchAndUpdateStatus() {
        try {
            const response = await fetch('/api/status');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const statusData = await response.json();
            updateUIWithStatus(statusData);
        } catch (error) {
            console.error('Failed to fetch status:', error);
            statusBarMessage.textContent = "Error fetching status.";
            resultsOutput.innerHTML = `<span style="color:red;">Error fetching status: ${error.message}</span>`;
        }
    }

    // Updates UI elements based on the fetched status data.
    function updateUIWithStatus(statusData) {
        if (statusData.is_connected) {
            connectDisconnectBtn.textContent = `Disconnect from ${statusData.connected_db_name}`;
            connectDisconnectBtn.style.backgroundColor = '#c0392b'; 
            runQueryBtn.disabled = false;
            statusBarMessage.textContent = `Connected to: ${statusData.connected_db_name}`; 
            connectDisconnectBtn.disabled = false; // Always enabled if connected (to allow disconnect)
        } else {
            if (statusData.active_config_name && statusData.active_config_details) {
                connectDisconnectBtn.textContent = `Connect to ${statusData.active_config_name}`;
                connectDisconnectBtn.style.backgroundColor = '#27ae60'; 
                connectDisconnectBtn.disabled = false; // Enable if there's an active config to connect to
            } else {
                connectDisconnectBtn.textContent = 'Connect'; 
                connectDisconnectBtn.style.backgroundColor = ''; 
                connectDisconnectBtn.disabled = true; // Disable if no active config and not connected
            }
            runQueryBtn.disabled = true;
            statusBarMessage.textContent = `Disconnected. Active Config: ${statusData.active_config_name || 'None'}`; 
        }
        populateConnectionSelect(currentConnectionsCache, statusData.active_config_name, connectionSelect);
    }

    // Fetches all connection configurations and populates relevant dropdowns.
    async function fetchConnectionsForDropdowns() {
        try {
            const response = await fetch('/api/connections'); 
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            currentConnectionsCache = data.connections || [];
            
            populateConnectionSelect(currentConnectionsCache, data.active_connection_name, connectionSelect);
            populateConnectionSelect(currentConnectionsCache, data.active_connection_name, modalConnectionList, true); 
            
            fetchAndUpdateStatus();
        } catch (error) { // Corrected: Added opening curly brace for catch block
            console.error('Failed to fetch connections list:', error);
            resultsOutput.innerHTML = `<span style="color:red;">Error fetching connections list: ${error.message}</span>`;
        }
    }

    // Populates a given select element with connection options.
    function populateConnectionSelect(connections, activeConfigName, selectElement, isModalList = false) {
        const currentSelectedValueInModal = isModalList ? selectElement.value : null;
        selectElement.innerHTML = ''; 
        if (connections && connections.length > 0) {
            connections.forEach(conn => {
                const option = document.createElement('option');
                option.value = conn.name;
                option.textContent = conn.name;
                if (!isModalList && conn.name === activeConfigName) {
                    option.selected = true;
                } else if (isModalList && conn.name === currentSelectedValueInModal) {
                     option.selected = true;
                }
                selectElement.appendChild(option);
            });
        } else {
            if (!isModalList) {
                const option = document.createElement('option');
                option.textContent = 'No configurations';
                option.disabled = true;
                selectElement.appendChild(option);
            }
        }
         if (!isModalList && selectElement.value !== activeConfigName && activeConfigName) {
             const activeOption = Array.from(selectElement.options).find(opt => opt.value === activeConfigName);
             if (activeOption) activeOption.selected = true;
        }
    }
    
    // Handles changing the active connection configuration.
    connectionSelect.addEventListener('change', async (event) => {
        const selectedName = event.target.value;
        if (!selectedName || selectedName === 'No configurations') return;
        try {
            const response = await fetch('/api/connections/set-active', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selectedName })
            });
            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            fetchAndUpdateStatus(); 
        } catch (error) {
            console.error('Failed to set active config:', error);
            resultsOutput.innerHTML = `<span style="color:red;">Error setting active config: ${error.message}</span>`;
        }
    });

    // Handles connect/disconnect button clicks.
    connectDisconnectBtn.addEventListener('click', async () => {
        const statusResponse = await fetch('/api/status'); 
        const statusData = await statusResponse.json();

        let endpoint = '';
        if (statusData.is_connected) {
            endpoint = '/api/disconnect';
        } else if (statusData.active_config_name && statusData.active_config_details) { 
            endpoint = '/api/connect';
        } else {
            resultsOutput.innerHTML = '<span style="color:orange;">No active configuration to connect to.</span>';
            statusBarMessage.textContent = "No active configuration.";
            return;
        }

        try {
            resultsOutput.innerHTML = `<span style="color:gray;">${statusData.is_connected ? 'Disconnecting...' : 'Connecting...'}</span>`;
            const response = await fetch(endpoint, { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                resultsOutput.innerHTML = `<span style="color:green;">${data.message || 'Operation successful.'}</span>`;
            } else {
                resultsOutput.innerHTML = `<span style="color:red;">Error: ${data.error || 'Operation failed.'}</span>`;
            }
        } catch (error) {
            console.error('Connect/Disconnect error:', error);
            resultsOutput.innerHTML = `<span style="color:red;">Network or server error: ${error.message}</span>`;
        } finally {
            fetchAndUpdateStatus(); 
        }
    });

    // Handles query execution.
    // If text is selected in the SQL editor, only that text is executed.
    // Otherwise, the entire content of the editor is executed.
    runQueryBtn.addEventListener('click', async () => {
        let queryToSend = '';
        const editorValue = sqlEditor.value;

        if (sqlEditor.selectionStart !== undefined && sqlEditor.selectionEnd !== undefined &&
            sqlEditor.selectionStart !== sqlEditor.selectionEnd) {
            queryToSend = editorValue.substring(sqlEditor.selectionStart, sqlEditor.selectionEnd);
        } else {
            queryToSend = editorValue;
        }

        queryToSend = queryToSend.trim();

        if (!queryToSend) {
            resultsOutput.innerHTML = '<span style="color:orange;">Query is empty (or selected part is empty).</span>';
            return;
        }
        
        resultsOutput.innerHTML = 'Executing query...';
        
        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryToSend })
            });
            const data = await response.json(); 
            resultsOutput.innerHTML = ''; 

            if (response.ok) {
                if (data.data_type === "error") {
                    resultsOutput.innerHTML = `<span style="color:red;">Query Error: ${data.error}</span>`;
                    statusBarMessage.textContent = 'Query Error.';
                } else if (data.data_type === "message") {
                    resultsOutput.innerHTML = `<span style="color:green;">${data.message}</span>`;
                    statusBarMessage.textContent = 'Query successful.';
                } else if (data.data_type === "table") {
                    if (data.data && data.data.length > 0) {
                        const table = document.createElement('table');
                        table.className = 'results-table';
                        const thead = table.createTHead();
                        const headerRow = thead.insertRow();
                        data.columns.forEach(headerText => {
                            const th = document.createElement('th');
                            th.textContent = headerText;
                            headerRow.appendChild(th);
                        });
                        const tbody = table.createTBody();
                        data.data.forEach(rowDataDict => { 
                            const row = tbody.insertRow();
                            data.columns.forEach(columnName => { 
                                const cell = row.insertCell();
                                cell.textContent = rowDataDict[columnName] !== null && rowDataDict[columnName] !== undefined ? rowDataDict[columnName] : 'NULL';
                            });
                        });
                        resultsOutput.appendChild(table);
                    } else if (data.columns && data.columns.length > 0) { 
                         resultsOutput.innerHTML = '<span style="color:gray;">Query executed. Columns returned, but no data rows.</span>';
                        const table = document.createElement('table');
                        table.className = 'results-table';
                        const thead = table.createTHead();
                        const headerRow = thead.insertRow();
                        data.columns.forEach(headerText => {
                            const th = document.createElement('th');
                            th.textContent = headerText;
                            headerRow.appendChild(th);
                        });
                        resultsOutput.appendChild(table);
                    } else { 
                        resultsOutput.innerHTML = '<span style="color:gray;">Query executed successfully, no data returned.</span>';
                    }
                    statusBarMessage.textContent = `Query successful. Rows: ${data.rows_affected !== undefined ? data.rows_affected : 'N/A'}`;
                }
            } else { 
                resultsOutput.innerHTML = `<span style="color:red;">Error: ${data.error || 'Unknown server error'}</span>`;
                statusBarMessage.textContent = 'Server Error.';
            }
        } catch (error) {
            console.error('Query execution error:', error);
            resultsOutput.innerHTML = `<span style="color:red;">Network or server error: ${error.message}</span>`;
            statusBarMessage.textContent = 'Network Error.';
        } 
    });

    // Handles loading an SQL file.
    loadSqlFileActual.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                sqlEditor.value = e.target.result;
                resultsOutput.innerHTML = `<span style="color:gray;">Loaded script: ${file.name}</span>`;
                statusBarMessage.textContent = `File loaded: ${file.name}`;
            };
            reader.readAsText(file);
            event.target.value = null; 
        }
    });

    // Handles saving the SQL script.
    saveSqlBtn.addEventListener('click', () => {
        const scriptContent = sqlEditor.value;
        const filename = prompt("Enter filename to save (e.g., query.sql):", "query.sql");
        if (!filename) return;

        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(scriptContent));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
        resultsOutput.innerHTML = `<span style="color:gray;">Script ${filename} download initiated.</span>`;
        statusBarMessage.textContent = `Script download: ${filename}`;
    });

    // App Info Modal event listeners
    if (appInfoBtn) {
        appInfoBtn.addEventListener('click', () => {
            if (appInfoModal) appInfoModal.style.display = 'block';
        });
    }
    if (closeAppInfoModalBtn) {
        closeAppInfoModalBtn.addEventListener('click', () => {
            if (appInfoModal) appInfoModal.style.display = 'none';
        });
    }
    if (okAppInfoModalBtn) { 
        okAppInfoModalBtn.addEventListener('click', () => {
            if (appInfoModal) appInfoModal.style.display = 'none';
        });
    }

    // Connections Config Modal event listeners
    if (manageConnectionsBtn) {
        manageConnectionsBtn.addEventListener('click', () => {
            if (connectionsModal) connectionsModal.style.display = 'block';
            fetchConnectionsForDropdowns(); 
            clearModalForm();
        });
    }
    if (closeConnectionsModalBtn) { 
        closeConnectionsModalBtn.addEventListener('click', () => {
            if (connectionsModal) connectionsModal.style.display = 'none';
            fetchConnectionsForDropdowns(); 
        });
    }

    // Close modals if clicked outside of their content area.
    window.addEventListener('click', (event) => { 
        if (event.target == connectionsModal) {
            if (connectionsModal) connectionsModal.style.display = 'none';
            fetchConnectionsForDropdowns();
        } else if (event.target == appInfoModal) { 
           if (appInfoModal) appInfoModal.style.display = 'none';
        }
    });
    
    // Clears the connection configuration form in the modal.
    function clearModalForm() {
        connNameInput.value = '';
        connPathInput.value = '';
        connReadonlyInput.checked = false;
        editingConnectionName = null;
        modalFormTitle.textContent = "Add New Configuration";
        connNameInput.disabled = false; 
    }

    if(newConnBtn) newConnBtn.addEventListener('click', clearModalForm);

    // Populates modal form when a connection is selected from the list.
    if(modalConnectionList) modalConnectionList.addEventListener('click', () => { 
        const selectedName = modalConnectionList.value;
        if (!selectedName) {
            clearModalForm(); 
            return;
        }
        const connDetail = currentConnectionsCache.find(c => c.name === selectedName);
        if (connDetail) {
            connNameInput.value = connDetail.name;
            connPathInput.value = connDetail.path;
            connReadonlyInput.checked = connDetail.read_only;
            editingConnectionName = connDetail.name; 
            modalFormTitle.textContent = "Edit Configuration";
        }
    });

    // Handles saving a new or edited connection configuration.
    if(saveConnBtn) saveConnBtn.addEventListener('click', async () => {
        const name = connNameInput.value.trim();
        const path = connPathInput.value.trim();
        const read_only = connReadonlyInput.checked;

        if (!name || !path) {
            alert('Configuration Name and Path are required.');
            return;
        }
        const payload = { name, path, read_only, original_name: editingConnectionName };
        try {
            const response = await fetch('/api/connections/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (response.ok) {
                if (result.requires_confirmation) {
                    if (confirm(result.message)) { 
                        const confirmResponse = await fetch('/api/connections/save', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...payload, confirm_create: true })
                        });
                        const confirmResult = await confirmResponse.json();
                        if (!confirmResponse.ok) throw new Error(confirmResult.error || 'Failed to save configuration after confirmation.');
                         alert(confirmResult.message || 'Configuration saved!');
                    } else {
                        alert('Configuration not saved as database creation was cancelled.');
                        return; 
                    }
                } else {
                     alert(result.message || 'Configuration saved!');
                }
                fetchConnectionsForDropdowns(); 
                clearModalForm();
            } else {
                throw new Error(result.error || 'Failed to save configuration.');
            }
        } catch (error) {
            console.error('Failed to save configuration:', error);
            alert(`Error saving configuration: ${error.message}`);
        }
    });

    // Handles deleting a connection configuration.
    if(deleteConnBtn) deleteConnBtn.addEventListener('click', async () => {
        const nameInForm = connNameInput.value.trim();
        const nameInList = modalConnectionList.value; 
        const nameToDelete = (editingConnectionName && editingConnectionName === nameInForm) ? editingConnectionName : nameInList;

        if (!nameToDelete) {
            alert('Please select a configuration to delete.');
            return;
        }
        if (!confirm(`Are you sure you want to delete configuration "${nameToDelete}"?`)) {
            return;
        }
        try {
            const response = await fetch('/api/connections/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameToDelete })
            });
            const result = await response.json();
            if (response.ok) {
                alert(result.message);
                fetchConnectionsForDropdowns();
                clearModalForm();
            } else {
                throw new Error(result.error || 'Failed to delete configuration.');
            }
        } catch (error) {
            console.error('Failed to delete configuration:', error);
            alert(`Error deleting configuration: ${error.message}`);
        }
    });

    // Initial load of connection configurations and UI status.
    fetchConnectionsForDropdowns();
});
