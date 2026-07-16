import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Friendly response handling
api.interceptors.response.use(
    (r) => r,
    (err) => {
        const status = err?.response?.status;
        if (status === 429) {
            toast.error("عدد محاولات كبير. رجاءً أعد المحاولة بعد قليل.");
        } else if (status === 403 && err?.response?.data?.detail?.includes("موقوف")) {
            // banned user
            toast.error(err.response.data.detail);
        }
        return Promise.reject(err);
    }
);

export default api;
