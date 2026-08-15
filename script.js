<<<<<<< HEAD
// Form Validation Functions

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Phone validation (10 digits)
function validatePhone(phone) {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    const levels = ['Too Short', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#C92A2A', '#FD7E14', '#FAB005', '#40C057', '#2B8A3E'];
    const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
    
    return {
        level: levels[strength] || 'Too Short',
        color: colors[strength] || '#C92A2A',
        width: widths[strength] || '0%'
    };
}

// Registration form validation
function validateRegistrationForm(formData) {
    const errors = [];
    
    if (!formData.name || formData.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    
    if (!validatePhone(formData.phone)) {
        errors.push('Phone number must be exactly 10 digits');
    }
    
    if (!validateEmail(formData.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!formData.password || formData.password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }
    
    if (formData.password !== formData.confirmPassword) {
        errors.push('Passwords do not match');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Login form validation
function validateLoginForm(formData) {
    const errors = [];
    
    if (!validateEmail(formData.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!formData.password || formData.password.length < 1) {
        errors.push('Password is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Display alert messages
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    const icon = type === 'success' ? '✅' : '❌';
    
    alertBox.innerHTML = `<div class="alert ${alertClass}">${icon} ${message}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertBox.innerHTML = '';
    }, 5000);
}

// Show multiple errors
function showErrors(errors) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const errorList = errors.map(err => `<li>${err}</li>`).join('');
    alertBox.innerHTML = `
        <div class="alert alert-error">
            <strong>❌ Please fix the following errors:</strong>
            <ul style="margin: 0.5rem 0 0 1.5rem;">
                ${errorList}
            </ul>
        </div>
    `;
}

// Format date to readable string
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Confirm action
function confirmAction(message) {
    return confirm(message);
}

// Show loading spinner
function showLoading(buttonElement, loadingText = 'Loading...') {
    if (!buttonElement) return;
    
    buttonElement.setAttribute('data-original-text', buttonElement.textContent);
    buttonElement.textContent = loadingText;
    buttonElement.disabled = true;
}

// Hide loading spinner
function hideLoading(buttonElement) {
    if (!buttonElement) return;
    
    const originalText = buttonElement.getAttribute('data-original-text');
    if (originalText) {
        buttonElement.textContent = originalText;
    }
    buttonElement.disabled = false;
}

// Debounce function for search/filter
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Session check (for protected pages)
function checkSession() {
    // This would normally check with the server
    // For now, just check if there's a success/error parameter
    const error = getUrlParameter('error');
    const success = getUrlParameter('success');
    
    if (error) {
        showAlert(error, 'error');
    }
    if (success) {
        showAlert(success, 'success');
    }
}

// Smooth scroll to element
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showAlert('Failed to copy to clipboard', 'error');
    });
}

// Initialize tooltips (if needed)
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltipText = e.target.getAttribute('data-tooltip');
            // Create and show tooltip
            console.log('Tooltip:', tooltipText);
        });
    });
}

// Auto-dismiss alerts after timeout
function autoDismissAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters and show alerts
    checkSession();
    
    // Auto-dismiss existing alerts
    autoDismissAlerts();
    
    // Initialize tooltips
    initTooltips();
    
    console.log('TiffinExpress - JavaScript initialized successfully! 🍱');
});

// Export functions for use in HTML pages
window.TiffinApp = {
    validateEmail,
    validatePhone,
    checkPasswordStrength,
    validateRegistrationForm,
    validateLoginForm,
    showAlert,
    showErrors,
    formatDate,
    formatCurrency,
    confirmAction,
    showLoading,
    hideLoading,
    smoothScrollTo,
    copyToClipboard
=======
// Form Validation Functions

// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Phone validation (10 digits)
function validatePhone(phone) {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
}

// Password strength checker
function checkPasswordStrength(password) {
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    const levels = ['Too Short', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['#C92A2A', '#FD7E14', '#FAB005', '#40C057', '#2B8A3E'];
    const widths = ['0%', '20%', '40%', '60%', '80%', '100%'];
    
    return {
        level: levels[strength] || 'Too Short',
        color: colors[strength] || '#C92A2A',
        width: widths[strength] || '0%'
    };
}

// Registration form validation
function validateRegistrationForm(formData) {
    const errors = [];
    
    if (!formData.name || formData.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters long');
    }
    
    if (!validatePhone(formData.phone)) {
        errors.push('Phone number must be exactly 10 digits');
    }
    
    if (!validateEmail(formData.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!formData.password || formData.password.length < 6) {
        errors.push('Password must be at least 6 characters long');
    }
    
    if (formData.password !== formData.confirmPassword) {
        errors.push('Passwords do not match');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Login form validation
function validateLoginForm(formData) {
    const errors = [];
    
    if (!validateEmail(formData.email)) {
        errors.push('Please enter a valid email address');
    }
    
    if (!formData.password || formData.password.length < 1) {
        errors.push('Password is required');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Display alert messages
function showAlert(message, type = 'error') {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    const icon = type === 'success' ? '✅' : '❌';
    
    alertBox.innerHTML = `<div class="alert ${alertClass}">${icon} ${message}</div>`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertBox.innerHTML = '';
    }, 5000);
}

// Show multiple errors
function showErrors(errors) {
    const alertBox = document.getElementById('alertBox');
    if (!alertBox) return;
    
    const errorList = errors.map(err => `<li>${err}</li>`).join('');
    alertBox.innerHTML = `
        <div class="alert alert-error">
            <strong>❌ Please fix the following errors:</strong>
            <ul style="margin: 0.5rem 0 0 1.5rem;">
                ${errorList}
            </ul>
        </div>
    `;
}

// Format date to readable string
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Confirm action
function confirmAction(message) {
    return confirm(message);
}

// Show loading spinner
function showLoading(buttonElement, loadingText = 'Loading...') {
    if (!buttonElement) return;
    
    buttonElement.setAttribute('data-original-text', buttonElement.textContent);
    buttonElement.textContent = loadingText;
    buttonElement.disabled = true;
}

// Hide loading spinner
function hideLoading(buttonElement) {
    if (!buttonElement) return;
    
    const originalText = buttonElement.getAttribute('data-original-text');
    if (originalText) {
        buttonElement.textContent = originalText;
    }
    buttonElement.disabled = false;
}

// Debounce function for search/filter
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Session check (for protected pages)
function checkSession() {
    // This would normally check with the server
    // For now, just check if there's a success/error parameter
    const error = getUrlParameter('error');
    const success = getUrlParameter('success');
    
    if (error) {
        showAlert(error, 'error');
    }
    if (success) {
        showAlert(success, 'success');
    }
}

// Smooth scroll to element
function smoothScrollTo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Copy to clipboard
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showAlert('Failed to copy to clipboard', 'error');
    });
}

// Initialize tooltips (if needed)
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltipText = e.target.getAttribute('data-tooltip');
            // Create and show tooltip
            console.log('Tooltip:', tooltipText);
        });
    });
}

// Auto-dismiss alerts after timeout
function autoDismissAlerts() {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check for URL parameters and show alerts
    checkSession();
    
    // Auto-dismiss existing alerts
    autoDismissAlerts();
    
    // Initialize tooltips
    initTooltips();
    
    console.log('TiffinExpress - JavaScript initialized successfully! 🍱');
});

// Export functions for use in HTML pages
window.TiffinApp = {
    validateEmail,
    validatePhone,
    checkPasswordStrength,
    validateRegistrationForm,
    validateLoginForm,
    showAlert,
    showErrors,
    formatDate,
    formatCurrency,
    confirmAction,
    showLoading,
    hideLoading,
    smoothScrollTo,
    copyToClipboard
>>>>>>> f72e3f8f488fd88a6765ac6467eb5e66030f53ad
};