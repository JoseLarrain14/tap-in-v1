const API_BASE = '/api';

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await response.json();

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

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  upload: (endpoint, formData) => uploadRequest(endpoint, formData),
};

export { getToken, setToken, removeToken };
