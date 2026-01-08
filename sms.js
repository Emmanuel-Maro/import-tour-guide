const crypto = require("crypto");
const axios = require("axios");
const { DateTime } = require("luxon");

async function sendSMS(phone, name) {
  try {
    // Set timezone and format phone number
    const timezone = "Africa/Dar_es_Salaam";
    const formattedPhone = "255" + phone.slice(-9);

    // Construct the message
    const message = `${name}, your OTP code is: 34234`;

    // API credentials
    const user_id = "shaaban.saidi@maliasili.go.tz";
    const sms_api_key = "p3dCaHVoXAWEyirmIZ4hJHX1oI9VhMXL1V5Sr0Yf";
    const url = "http://msdg.ega.go.tz/msdg/public/quick_sms";

    // Get current datetime in the specified timezone
    const current_date = DateTime.now()
      .setZone(timezone)
      .toFormat("yyyy-MM-dd HH:mm:ss");

    // Prepare SMS data
    const sms_data = JSON.stringify({
      recipients: formattedPhone,
      message: message,
      datetime: current_date,
      sender_id: "MALIASILI",
      mobile_service_id: "545",
    });

    // Generate HMAC hash
    const hash = crypto
      .createHmac("sha256", sms_api_key)
      .update(sms_data)
      .digest("base64");

    // Prepare request headers
    const headers = {
      "X-Auth-Request-Hash": hash,
      "X-Auth-Request-Id": user_id,
      "X-Auth-Request-Type": "api",
    };

    // Make the API request
    const response = await axios.post(
      url,
      {
        data: sms_data,
        datetime: current_date,
      },
      { headers }
    );

    return response.data;
  } catch (error) {
    console.error("Error sending SMS:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
    throw error;
  }
}

//Example usage:
// sendSMS("0789773634", "Baraka", "12345")
//   .then((response) => console.log("SMS sent:", response))
//   .catch((err) => console.error("Failed to send SMS:", err));
