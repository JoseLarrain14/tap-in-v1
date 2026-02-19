// En producción (Netlify) usar VITE_API_URL; en local el proxy usa /api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function removeToken() {
  localStorage.removeItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    // If the request was aborted (e.g., by navigation), throw a specific error
    if (networkError.name === 'AbortError') {
      const err = new Error('Request cancelled');
      err.isAborted = true;
      throw err;
    }
    // Network error - server unreachable
    const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
    err.isNetworkError = true;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    // Response was not JSON - likely proxy error (502/503) or server crash
    if (response.status >= 502 && response.status <= 504) {
      const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
      err.isNetworkError = true;
      err.status = response.status;
      throw err;
    }
    const err = new Error('El servidor respondió de forma inesperada. Intente nuevamente.');
    err.status = response.status;
    throw err;
  }

  // For 401 on non-login endpoints, clear token and redirect
  if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
    removeToken();
    window.location.href = '/login';
    throw new Error('No autenticado');
  }

  if (!response.ok) {
    const err = new Error(data.error || 'Error en la solicitud');
    err.status = response.status;
    if (data.fields) err.fields = data.fields;
    throw err;
  }

  return data;
}

async function uploadRequest(endpoint, formData) {
  const token = getToken();
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Do NOT set Content-Type for FormData — browser sets it with boundary

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (networkError) {
    const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
    err.isNetworkError = true;
    throw err;
  }

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    // Response was not JSON - likely proxy error (502/503) or server crash
    if (response.status >= 502 && response.status <= 504) {
      const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
      err.isNetworkError = true;
      err.status = response.status;
      throw err;
    }
    const err = new Error('El servidor respondió de forma inesperada. Intente nuevamente.');
    err.status = response.status;
    throw err;
  }

  if (response.status === 401 && !endpoint.startsWith('/auth/login')) {
    removeToken();
    window.location.href = '/login';
    throw new Error('No autenticado');
  }

  if (!response.ok) {
    const err = new Error(data.error || 'Error en la solicitud');
    err.status = response.status;
    if (data.fields) err.fields = data.fields;
    throw err;
  }

  return data;
}

/**
 * Upload with XHR progress tracking.
 * @param {string} endpoint - API endpoint
 * @param {FormData} formData - FormData to upload
 * @param {function} onProgress - Callback with { loaded, total, percent }
 * @returns {Promise<object>} Parsed JSON response
 */
function uploadWithProgress(endpoint, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const token = getToken();

    xhr.open('POST', `${API_BASE}${endpoint}`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress({ loaded: e.loaded, total: e.total, percent });
      }
    });

    xhr.addEventListener('load', () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (parseError) {
        if (xhr.status >= 502 && xhr.status <= 504) {
          const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
          err.isNetworkError = true;
          err.status = xhr.status;
          return reject(err);
        }
        const err = new Error('El servidor respondió de forma inesperada. Intente nuevamente.');
        err.status = xhr.status;
        return reject(err);
      }

      if (xhr.status === 401 && !endpoint.startsWith('/auth/login')) {
        removeToken();
        window.location.href = '/login';
        return reject(new Error('No autenticado'));
      }

      if (xhr.status >= 400) {
        const err = new Error(data.error || 'Error en la solicitud');
        err.status = xhr.status;
        if (data.fields) err.fields = data.fields;
        return reject(err);
      }

      // Signal 100% completion
      if (onProgress) {
        onProgress({ loaded: 1, total: 1, percent: 100 });
      }

      resolve(data);
    });

    xhr.addEventListener('error', () => {
      const err = new Error('No se pudo conectar con el servidor. Verifique su conexión e intente nuevamente.');
      err.isNetworkError = true;
      reject(err);
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelado'));
    });

    xhr.send(formData);
  });
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options }),
  post: (endpoint, body, options) => request(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  put: (endpoint, body, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
  upload: (endpoint, formData) => uploadRequest(endpoint, formData),
  uploadWithProgress: (endpoint, formData, onProgress) => uploadWithProgress(endpoint, formData, onProgress),
};

export { getToken, setToken, removeToken };
