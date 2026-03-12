import { createApp } from "../../src/app.js";

const DEFAULT_PORT = 4000;
const rawPort = process.env["PORT"];
const PORT = rawPort !== undefined ? Number(rawPort) : DEFAULT_PORT;

if (!Number.isInteger(PORT) || PORT <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
}

const app = createApp();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});