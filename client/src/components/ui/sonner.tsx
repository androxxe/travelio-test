import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      gap={8}
      toastOptions={{
        style: {
          borderRadius: "10px",
          border: "1px solid #E2E2DD",
          background: "#FFFFFF",
          color: "#17181A",
          fontFamily: '"Instrument Sans Variable", ui-sans-serif, sans-serif',
          fontSize: "13px",
          boxShadow: "0 18px 40px -24px rgba(23, 24, 26, 0.45)",
        },
      }}
    />
  );
}

export { Toaster };
