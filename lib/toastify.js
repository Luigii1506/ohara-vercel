import { toast } from "react-toastify";

export const showSuccessToast = (message) => {
  toast.dismiss();
  toast.success(message, {
    autoClose: 1000,
    position: "top-center",
  });
};

export const showErrorToast = (message) => {
  toast.dismiss();
  toast.error(message, {
    autoClose: 1000,
    position: "top-center",
  });
};

export const showWarningToast = (message) => {
  toast.dismiss();
  toast.warn(message, {
    autoClose: 1000,
    position: "top-center",
    style: {
      maxWidth: "90vw", // Ajusta el ancho máximo del toast
      whiteSpace: "normal", // Permite que el texto se envuelva
      wordBreak: "break-word",
    },
  });
};

export const showPromiseToast = (promise, messages = {}) => {
  toast.dismiss();
  return toast.promise(
    promise,
    {
      pending: messages.pending || "Cargando...",
      success: messages.success || "¡Operación exitosa!",
      error: messages.error || "Ocurrió un error",
    },
    {
      autoClose: 1000,
      position: "top-center",
      style: {
        maxWidth: "90vw",
        whiteSpace: "normal",
        wordBreak: "break-word",
      },
    }
  );
};
