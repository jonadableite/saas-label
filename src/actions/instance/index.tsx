// src/actions/instance/index.tsx
import { getInstanceStatus } from "./connection-status";
import { createInstance } from "./create-instance";
import { deleteInstance } from "./delete-instance";
import { fetchInstances } from "./fetch-instances";
import { getInstanceQrCode } from "./instance-connect";
import { logoutInstance } from "./logout-instance";
import { restartInstance } from "./restart-instance";
import { setInstancePresence } from "./set-presence";

export {
  createInstance,
  deleteInstance,
  fetchInstances,
  getInstanceQrCode,
  getInstanceStatus,
  logoutInstance,
  restartInstance,
  setInstancePresence,
};
