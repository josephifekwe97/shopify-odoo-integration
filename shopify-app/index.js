require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const PORT = 3000;

// ===== Step 1: OAuth Install Route =====
app.get("/auth", async (req,res)=>{
  const shop = req.query.shop;
  const scopes = "read_orders,read_customers,read_products,write_inventory,write_fulfillments,write_products";

  const installUrl =
    `https://${shop}/admin/oauth/authorize?` +
    `client_id=${process.env.SHOPIFY_API_KEY}` +
    `&scope=${scopes}` +
    `&redirect_uri=${process.env.HOST}/auth/callback`;

  res.redirect(installUrl);
});

// ===== Step 2: OAuth Callback =====
app.get("/auth/callback", async (req,res)=>{
  const {shop, code} = req.query;

  try {
    const tokenRes = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code
      }
    );

    console.log("ACCESS TOKEN:", tokenRes.data.access_token);
    res.send("App installed successfully!");
  } catch (err) {
    console.error("OAuth callback error:", err.response?.data || err);
    res.status(500).send("Error during OAuth installation");
  }
});

// ===== Step 3: Shopify Webhook Endpoint =====
function verifyShopify(req){
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(JSON.stringify(req.body))
    .digest("base64");

  return digest === hmac;
}

app.post("/webhooks/orders_create", async (req,res)=>{
  if(!verifyShopify(req)){
    return res.status(401).send("Unauthorized");
  }

  const order = req.body;

  try {
    await axios.post(`${process.env.ODOO_URL}/sync/order`, order);
    console.log("Order forwarded to Odoo:", order.id);
    res.status(200).send("ok");
  } catch(err){
    console.error("Error sending order to Odoo:", err.message);
    res.status(500).send("Error");
  }
});

// ===== Step 4: Basic Root Endpoint =====
app.get("/", (req,res)=>{
  res.send("Shopify → Odoo Integration Running");
});

// ===== Step 5: Start Server =====
app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));