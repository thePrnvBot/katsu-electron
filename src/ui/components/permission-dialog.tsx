import { useEffect, useState } from "react";

interface PermissionRequest {
  id: string;
  permission: string;
  origin: string;
  message: string;
}

export const PermissionDialog = () => {
  const [request, setRequest] = useState<PermissionRequest | null>(null);

  useEffect(() => {
    window.electronAPI.setPermissionRequestHandler((req) => {
      setRequest(req);
    });
  }, []);

  if (!request) {
    return null;
  }

  const handleResponse = (granted: boolean) => {
    window.electronAPI.respondToPermission(request.id, granted);
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-lg bg-[#1a1a1a] p-6 shadow-xl">
        <h3 className="text-lg font-medium text-white">Permission Request</h3>
        <p className="mt-2 text-sm text-gray-400">
          {request.origin} wants to access {request.permission}.
        </p>
        <p className="mt-1 text-sm text-gray-400">{request.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => handleResponse(false)}
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={() => handleResponse(true)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};
