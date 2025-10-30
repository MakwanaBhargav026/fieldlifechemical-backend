// backend/routes/imageAuth.js
import express from "express";
import imagekit from "../imagekit.js";

const router = express.Router();

router.get("/auth", (req, res) => {
  const authParams = imagekit.getAuthenticationParameters();
  res.json(authParams);
});

export default router;
