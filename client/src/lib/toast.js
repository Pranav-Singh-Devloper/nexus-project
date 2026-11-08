import { createContext, useContext } from 'react';

// toast.success(message, { actions: [{ label, href | to | onClick, icon }], sticky, duration })
export const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);
