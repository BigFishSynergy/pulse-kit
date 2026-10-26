import { CO, CRM } from "./config";

// The card a texted or posted Pulse link shows. The image is public/pulse/og.png (replace it with the client's own,
// 1200 x 630; the kit ships a neutral one).
export const OG = {
  title: `${CO.pulse_name} · ${CO.name}`,
  description: `Every number, every rep, every zip. Live from ${CRM}, every hour.`,
  image: `${CO.site_url}/pulse/og.png`,
};
