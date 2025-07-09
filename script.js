// User credentials - you can change these passwords
const USER_CREDENTIALS = {
    "Miso": "miso123",
    "Stano": "stano456", 
    "Juro": "juro789",
    "Marek": "marek012"
};

// Store entries in localStorage
let entries = JSON.parse(localStorage.getItem('motohoursEntries')) || [];
let chargingSessions = JSON.parse(localStorage.getItem('chargingSessions')) || [];
let currentUser = null;
let activeChargingSession = null;

// DOM elements
const datetimeElement = document.getElementById('datetime');
const loginSection = document.getElementById('loginSection');
const mainContent = document.getElementById('mainContent');
const userSelect = document.getElementById('userSelect');
const passwordInput = document.getElementById('passwordInput');
const errorMessage = document.getElementById('errorMessage');
const motohoursForm = document.getElementById('motohoursForm');
const tableBody = document.getElementById('tableBody');
const userInfo = document.getElementById('userInfo');
const currentUserName = document.getElementById('currentUserName');
const mainUserName = document.getElementById('mainUserName');
const startChargingBtn = document.getElementById('startChargingBtn');
const stopChargingBtn = document.getElementById('stopChargingBtn');
const chargingStatus = document.getElementById('chargingStatus');
const chargingTableBody = document.getElementById('chargingTableBody');

// Update date and time every second
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    datetimeElement.textContent = now.toLocaleDateString('en-US', options);
}

// Check password function
function checkPassword() {
    const selectedUser = userSelect.value;
    const enteredPassword = passwordInput.value;
    
    if (!selectedUser) {
        errorMessage.textContent = 'Please select a user.';
        return;
    }
    
    if (enteredPassword === USER_CREDENTIALS[selectedUser]) {
        currentUser = selectedUser;
        loginSection.style.display = 'none';
        mainContent.style.display = 'grid';
        errorMessage.textContent = '';
        passwordInput.value = '';
        userSelect.value = '';
        
        // Update user display
        currentUserName.textContent = selectedUser;
        mainUserName.textContent = selectedUser;
        

        
        loadEntries();
        loadChargingSessions();
        checkActiveChargingSession();
        showNotification(`Welcome, ${selectedUser}!`, 'success');
    } else {
        errorMessage.textContent = 'Incorrect password for this user. Please try again.';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Logout function
function logout() {
    currentUser = null;
    loginSection.style.display = 'flex';
    mainContent.style.display = 'none';
    userInfo.style.display = 'none';
    errorMessage.textContent = '';
    passwordInput.value = '';
    userSelect.value = '';
    showNotification('Logged out successfully!', 'info');
}

// Handle form submission
function handleFormSubmit(event) {
    event.preventDefault();
    
    const motohours = parseFloat(document.getElementById('motohours').value);
    const batteryCapacity = parseInt(document.getElementById('batteryCapacity').value);
    
    if (isNaN(motohours) || isNaN(batteryCapacity)) {
        alert('Please fill in all fields correctly.');
        return;
    }
    
    const entry = {
        id: Date.now(),
        datetime: new Date().toLocaleString(),
        name: currentUser,
        motohours: motohours,
        batteryCapacity: batteryCapacity
    };
    
    entries.push(entry);
    saveEntries();
    displayEntries();
    motohoursForm.reset();
    
    // Show success message
    showNotification('Entry added successfully!', 'success');
}

// Display entries in table
function displayEntries() {
    tableBody.innerHTML = '';
    
    if (entries.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #718096;">No entries yet</td></tr>';
        return;
    }
    
    entries.forEach(entry => {
        const isOwnEntry = entry.name === currentUser;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${entry.datetime}</td>
            <td>${entry.name}</td>
            <td>${entry.motohours}</td>
            <td>${entry.batteryCapacity}%</td>
            <td>
                ${isOwnEntry ? `<button class="delete-btn" onclick="deleteEntry(${entry.id})">Delete</button>` : '<span class="no-action">-</span>'}
            </td>
        `;
        
        // Add visual indication for own entries
        if (isOwnEntry) {
            row.style.backgroundColor = 'rgba(72, 187, 120, 0.1)';
            row.style.borderLeft = '4px solid #48bb78';
        }
        
        tableBody.appendChild(row);
    });
}

// Delete entry
function deleteEntry(id) {
    // Check if the entry belongs to the current user
    const entry = entries.find(e => e.id === id);
    if (!entry || entry.name !== currentUser) {
        showNotification('You can only delete your own entries!', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this entry?')) {
        entries = entries.filter(entry => entry.id !== id);
        saveEntries();
        displayEntries();
        showNotification('Entry deleted successfully!', 'success');
    }
}

// Clear all entries
function clearAllEntries() {
    if (confirm('Are you sure you want to clear all your entries? This action cannot be undone.')) {
        // Only clear entries for the current user
        entries = entries.filter(entry => entry.name !== currentUser);
        saveEntries();
        displayEntries();
        showNotification('All your entries cleared!', 'success');
    }
}

// Save entries to localStorage
function saveEntries() {
    localStorage.setItem('motohoursEntries', JSON.stringify(entries));
}

// Save charging sessions to localStorage
function saveChargingSessions() {
    localStorage.setItem('chargingSessions', JSON.stringify(chargingSessions));
}

// Load entries from localStorage
function loadEntries() {
    entries = JSON.parse(localStorage.getItem('motohoursEntries')) || [];
    displayEntries();
}

// Load charging sessions from localStorage
function loadChargingSessions() {
    chargingSessions = JSON.parse(localStorage.getItem('chargingSessions')) || [];
    displayChargingSessions();
}

// Check if user has active charging session
function checkActiveChargingSession() {
    activeChargingSession = chargingSessions.find(session => 
        session.user === currentUser && session.status === 'active'
    );
    updateChargingUI();
}

// Update charging UI based on active session
function updateChargingUI() {
    // Check if there's any active charging session (not just current user's)
    const anyActiveSession = chargingSessions.find(session => session.status === 'active');
    
    if (activeChargingSession) {
        // Current user has an active session
        startChargingBtn.disabled = true;
        stopChargingBtn.disabled = false;
        chargingStatus.className = 'charging-status active';
        chargingStatus.innerHTML = `<p>Your charging started at: ${activeChargingSession.startTime}</p>`;
    } else if (anyActiveSession) {
        // Someone else has an active session
        startChargingBtn.disabled = true;
        stopChargingBtn.disabled = false;
        chargingStatus.className = 'charging-status active';
        chargingStatus.innerHTML = `<p>${anyActiveSession.user}'s charging started at: ${anyActiveSession.startTime}</p>`;
    } else {
        // No active sessions
        startChargingBtn.disabled = false;
        stopChargingBtn.disabled = true;
        chargingStatus.className = 'charging-status';
        chargingStatus.innerHTML = '<p>No active charging session</p>';
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    let backgroundColor;
    switch(type) {
        case 'success':
            backgroundColor = '#48bb78';
            break;
        case 'error':
            backgroundColor = '#e53e3e';
            break;
        default:
            backgroundColor = '#667eea';
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        background: ${backgroundColor};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    motohoursForm.addEventListener('submit', handleFormSubmit);
    
    // Allow Enter key to submit password
    passwordInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            checkPassword();
        }
    });
    
    // Allow Enter key to submit user selection
    userSelect.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            passwordInput.focus();
        }
    });
    
    // Allow Enter key to submit form
    document.getElementById('motohours').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            motohoursForm.dispatchEvent(new Event('submit'));
        }
    });
    
    document.getElementById('batteryCapacity').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            motohoursForm.dispatchEvent(new Event('submit'));
        }
    });
});

// Start charging function
function startCharging() {
    // Check if there's any active charging session (not just current user's)
    const anyActiveSession = chargingSessions.find(session => session.status === 'active');
    
    if (anyActiveSession) {
        const message = anyActiveSession.user === currentUser 
            ? 'You already have an active charging session!'
            : `${anyActiveSession.user} already has an active charging session!`;
        showNotification(message, 'error');
        return;
    }
    
    const session = {
        id: Date.now(),
        user: currentUser,
        startTime: new Date().toLocaleString(),
        stopTime: null,
        duration: null,
        status: 'active'
    };
    
    chargingSessions.push(session);
    activeChargingSession = session;
    saveChargingSessions();
    displayChargingSessions();
    updateChargingUI();
    showNotification('Charging started!', 'success');
}

// Stop charging function
function stopCharging() {
    // Find any active charging session (not just current user's)
    const anyActiveSession = chargingSessions.find(session => session.status === 'active');
    
    if (!anyActiveSession) {
        showNotification('No active charging session to stop!', 'error');
        return;
    }
    
    const stopTime = new Date();
    const startTime = new Date(anyActiveSession.startTime);
    const durationMs = stopTime - startTime;
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    const durationHours = Math.floor(durationMinutes / 60);
    const remainingMinutes = durationMinutes % 60;
    
    let durationText = '';
    if (durationHours > 0) {
        durationText = `${durationHours}h ${remainingMinutes}m`;
    } else {
        durationText = `${durationMinutes}m`;
    }
    
    anyActiveSession.stopTime = stopTime.toLocaleString();
    anyActiveSession.duration = durationText;
    anyActiveSession.status = 'completed';
    
    // If this was the current user's active session, clear it
    if (activeChargingSession && activeChargingSession.id === anyActiveSession.id) {
        activeChargingSession = null;
    }
    
    saveChargingSessions();
    displayChargingSessions();
    updateChargingUI();
    
    const message = anyActiveSession.user === currentUser 
        ? `Your charging stopped! Duration: ${durationText}`
        : `${anyActiveSession.user}'s charging stopped by ${currentUser}! Duration: ${durationText}`;
    
    showNotification(message, 'success');
}

// Display charging sessions in table
function displayChargingSessions() {
    chargingTableBody.innerHTML = '';
    
    if (chargingSessions.length === 0) {
        chargingTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #718096;">No charging sessions yet</td></tr>';
        return;
    }
    
    chargingSessions.forEach(session => {
        const isOwnSession = session.user === currentUser;
        const row = document.createElement('tr');
        
        const stopTime = session.stopTime || '-';
        const duration = session.duration || '-';
        const status = session.status === 'active' ? '🟢 Active' : '✅ Completed';
        
        row.innerHTML = `
            <td>${session.user}</td>
            <td>${session.startTime}</td>
            <td>${stopTime}</td>
            <td>${duration}</td>
            <td>${status}</td>
            <td>
                ${isOwnSession && session.status === 'completed' ? `<button class="delete-btn" onclick="deleteChargingSession(${session.id})">Delete</button>` : '<span class="no-action">-</span>'}
            </td>
        `;
        
        // Add visual indication for own sessions
        if (isOwnSession) {
            row.style.backgroundColor = 'rgba(72, 187, 120, 0.1)';
            row.style.borderLeft = '4px solid #48bb78';
        }
        
        chargingTableBody.appendChild(row);
    });
}

// Delete charging session
function deleteChargingSession(id) {
    const session = chargingSessions.find(s => s.id === id);
    if (!session || session.user !== currentUser) {
        showNotification('You can only delete your own charging sessions!', 'error');
        return;
    }
    
    if (session.status === 'active') {
        showNotification('Cannot delete active charging session!', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this charging session?')) {
        chargingSessions = chargingSessions.filter(s => s.id !== id);
        saveChargingSessions();
        displayChargingSessions();
        showNotification('Charging session deleted successfully!', 'success');
    }
}

// Clear all charging sessions for current user
function clearAllChargingSessions() {
    if (confirm('Are you sure you want to clear all your charging sessions? This action cannot be undone.')) {
        // Only clear completed sessions for the current user
        chargingSessions = chargingSessions.filter(session => 
            session.user !== currentUser || session.status === 'active'
        );
        saveChargingSessions();
        displayChargingSessions();
        showNotification('All your charging sessions cleared!', 'success');
    }
}

// Export functions for global access
window.checkPassword = checkPassword;
window.logout = logout;
window.deleteEntry = deleteEntry;
window.clearAllEntries = clearAllEntries;
window.startCharging = startCharging;
window.stopCharging = stopCharging;
window.deleteChargingSession = deleteChargingSession;
window.clearAllChargingSessions = clearAllChargingSessions; 