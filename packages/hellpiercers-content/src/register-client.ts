import { registerClientContentPack } from "@gaem/client/content-pack";

import { hellpiercersClientContent } from "./client/hellpiercers-client-content.js";
import "./client/themes.css";

registerClientContentPack(hellpiercersClientContent());
