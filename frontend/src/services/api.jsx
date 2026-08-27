import axios from 'axios';

// This points to the FastAPI server running on your machine
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

/**
 * Sends the raw text and configuration to the backend for PII redaction.
 * @param {Object} payload - Must match the RedactionRequest Pydantic schema
 */
export const processRedaction = async (payload) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/redact`, payload);
        return response.data;
    } catch (error) {
        // If FastAPI throws a 422 Validation Error or 500 Server Error, we catch it here
        console.error("API Error:", error.response?.data || error.message);
        throw error; 
    }
};

/**
 * Sends a file and configuration to the backend for extraction and redaction.
 */
export const processFileRedaction = async (files, entities, maskChar) => {
    const formData = new FormData();
    
    // Append each file to the same 'files' key
    Array.from(files).forEach(file => {
        formData.append('files', file);
    });
    
    if (entities && entities.length > 0) {
        formData.append('entities', entities.join(','));
    }
    formData.append('mask_char', maskChar);

    const response = await axios.post(`${API_BASE_URL}/redact/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

/**
 * Polls the backend to check the status of a Celery background task.
 */
export const checkTaskStatus = async (taskId) => {
    try {
        const response = await axios.get(`${API_BASE_URL}/tasks/${taskId}`);
        return response.data;
    } catch (error) {
        console.error("Task Status API Error:", error.response?.data || error.message);
        throw error;
    }
};