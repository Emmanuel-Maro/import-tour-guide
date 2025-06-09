const fs = require("fs");
const csv = require("csv-parser");
const { Pool } = require("pg");
require("dotenv").config();
const axios = require("axios");
const args = process.argv.slice(2);

const first_name_arg = args[0];
const middle_name_arg = args[1];
const last_name_arg = args[2];
const license_year = args[3]; // if parm '2025' is set will create 2025 year license, if other year set it will not issuer license, should use licensing-guide.js to issue license
var token = null;
var headers = {
  "Content-Type": "application/json",
};

const dblocal = require("./db").pg(
  process.env.DB_DATABASE_NAME,
  process.env.DB_HOST,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  console
);

var client = {
  name: null,
  email: null,
  address: null,
  physical_address: null,
  id_number: null,
  phone: null,
  gender: null,
  registration_number: null,
  category: null,
  client_type_id: 5,
  license_number: null,
};
var created_client_id = null;
var tour_guide_id = null;

var client_exist = false;
var is_client_company = true;

// Date Time: YYYY-MM-DD HH:mm:ss
const now = new Date();
const nowFormatted =
  `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")} ` +
  `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;

console.log("STEP 1: Reading CSV file...");
console.log();

const stream = fs.createReadStream("MNRT_GUIDE_LICENSE.csv").pipe(csv());

stream.on("data", async (row) => {
  try {
    //---- Read CSV data ----
    const {
      email,
      first_name,
      middle_name,
      last_name,
      company,
      xyear,
      physical_address,
      gender,
      registration_number,
      category,
      mobile,
      license_number,
    } = row;

    const companyArray = company.trim().split(/\s+/);

    //check if client exist
    if (
      first_name == first_name_arg &&
      middle_name == middle_name_arg &&
      last_name == last_name_arg
    ) {
      client_exist = true;

      // check if client not belong to company client and has 2025 license
      if (
        first_name == companyArray[0] &&
        middle_name == companyArray[1] &&
        last_name == companyArray[2] &&
        xyear == license_year
      ) {
        is_client_company = false;
        console.log(
          `Client ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- Exist...`
        );
        console.log(
          `Client ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- NOT belong to Company...`
        );
        console.log(
          `Client ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- Has ${xyear} License...`
        );

        //set Client object
        client.name = `${first_name_arg} ${middle_name_arg} ${last_name_arg}`;
        client.address = physical_address.trim();
        client.physical_address = physical_address.trim();
        client.email = email.trim();
        client.gender = gender.trim();
        client.registration_number = registration_number.trim();
        client.category = category.trim();
        client.phone = `255${mobile.trim().slice(-9)}`;
        client.id_number = `0${mobile.trim().slice(-9)}`;
        client.license_number = license_number;

        console.log(`Client object: `, client);

        //check if client exist in client table
        console.log();
        console.log(`STEP 2: Checking if client exist in the Live Database...`);
        console.log();

        //---End CSV search LOOP
        stream.destroy();
        //----------------------
        if (email == "NONE") {
          console.log(
            `Client has NO EMAIL ADDRESS in the excel --------------- END`
          );
          process.exit();
        } else {
          checkRemoteClient(first_name, middle_name, last_name);
        }
      }
    }
  } catch (err) {
    console.error("Error processing row:", err.message);
  }
});

stream.on("end", () => {
  //check if client exist
  if (!client_exist)
    console.log(
      `Client ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- NOT exist!`
    );

  if (is_client_company) {
    console.log(
      `OR Client ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- BELONG to company!`
    );
  }

  console.log("Stream finished.");
});

stream.on("close", () => {
  //console.log("Stream closed.");
});

stream.on("error", (err) => {
  if (err.code !== "ERR_STREAM_PREMATURE_CLOSE") {
    console.error("Stream error:", err);
  }
});

function checkRemoteClient(_first_name, _middle_name, _last_name) {
  //------ Request token -------
  console.log("Requesting token...");

  axios
    .post(`${process.env.URL}/api/v1/login`, {
      email: process.env.EMAIL,
      password: process.env.PASSWORD,
    })
    .then((response) => {
      console.log("Token created successfully...");
      token = response.data.data.token;

      //-------- Check if client exist in db
      headers.Authorization = `Bearer ${token}`;

      axios
        .get(
          `${process.env.URL}/api/v1/search-clients/${_first_name}%20${_middle_name}%20${_last_name}`,
          {
            headers,
          }
        )
        .then((response) => {
          //console.log(`Check client: `, response.data);
          if (response.data.data && response.data.data.length > 0) {
            console.log(
              `Client ${_first_name} ${_middle_name} ${_last_name} ------------------- EXIST in the Live Database!`
            );

            const remote_client = response.data.data;

            // get client id and check/create tour guide if client exist (single record)
            if (remote_client.length == 1) {
              console.log(
                `Client ID: ${remote_client[0].id} ---- Continue creating tour guide...`
              );
              created_client_id = remote_client[0].id;
              checkRemoteTourGuide();
            } else if (remote_client.length > 1) {
              console.log("Multiple Client Exist--------------END");

              remote_client.forEach((item, index) => {
                console.log(`Client Found:`);
                console.log(`${index + 1}. ${item.name} - ${item.phone}`);
              });
              process.exit();
            }
          }
        })
        .catch((error) => {
          if (
            error.response?.data &&
            error.response?.data.message == "Client Not Found"
          ) {
            //----------- Create Client ------------
            creatClient();
          } else {
            console.error(
              "Check Remote error:",
              error.response?.data.message || error.response?.data || error
            );
          }
        });
    })
    .catch((error) => {
      console.error("Token error:", error.message);
    });
}

function creatClient() {
  //----------- Create Client ------------
  console.log("Client NOT exist. Continue next....");
  console.log();
  console.log(
    `STEP 3: Creating client ${first_name_arg} ${middle_name_arg} ${last_name_arg} ....`
  );
  console.log();

  const {
    gender,
    registration_number,
    category,
    license_number,
    ...newClient
  } = client;
  client.client_type_id = 5;
  axios
    .post(`${process.env.URL}/api/v1/clients`, newClient, { headers })
    .then((response) => {
      if (response?.data.data.name) {
        console.log(
          `Client ${response.data.data.name} --- Created successfully...`
        );
        created_client_id = response.data.data.id;
        console.log(`Created client: `, response.data.data);

        //----------- Check and Create Tour Guide ------------
        checkRemoteTourGuide();
      } else {
        console.log(`Client ${_client} NOT created!`);
      }
    })
    .catch((error) => {
      console.error(
        "Create Client error:",
        error.response?.data.message || error.response?.data || error
      );
    });
}

function checkRemoteTourGuide() {
  console.log();
  console.log(
    `STEP 4: Check Tour Guide ${first_name_arg} ${middle_name_arg} ${last_name_arg} .... `
  );
  console.log();
  axios
    .get(
      `${process.env.URL}/api/v1/ttlb-tour-guides?name=${first_name_arg}+${middle_name_arg}+${last_name_arg}&page=1&per_page=10&query=${first_name_arg}+${middle_name_arg}+${last_name_arg}`,
      {
        headers,
      }
    )
    .then((response) => {
      if (response.data.data && response.data.data.data.length > 0) {
        console.log(
          `Tour Guide ${first_name_arg} ${middle_name_arg} ${last_name_arg} ---------------- EXIST in the Live Database!`
        );

        if (response.data.data.data.length == 1) {
          tour_guide_id = response.data.data.data[0].id;
          console.log(
            `Tour Guide ID: ${tour_guide_id} ---- Continue creating license...`
          );
          //create Tour Guide license
          createTourGuideLicense();
        } else if (response.data.data.data.length > 1) {
          console.log("Multiple Tour Guide Exist--------------END");
          process.exit();
        }
      } else {
        //Create TourGuide
        console.log(`Tour Guide NOT exist. Continue next....`);
        createTourGuide();
      }
    })
    .catch((error) => {
      console.error(
        "Check Tour Guide error:",
        error.response?.data.message || error.response?.data || error
      );
    });
}
function createTourGuide() {
  //----------- Create Tour Guide ------------
  console.log();
  console.log(
    `STEP 5: Creating Tour Guide ${first_name_arg} ${middle_name_arg} ${last_name_arg} ....`
  );
  console.log();

  const {
    name,
    registration_number,
    address,
    phone,
    id_number,
    client_type_id,
    category,
    license_number,
    ...newClient
  } = client;
  newClient.client_id = created_client_id;
  newClient.identification_number = client.id_number;
  newClient.first_name = first_name_arg;
  newClient.middle_name = middle_name_arg;
  newClient.last_name = last_name_arg;
  newClient.languages = "NA";
  newClient.physical_address = client.address;
  newClient.postal_address = client.address;
  newClient.user_languages = [1, 3];
  newClient.mobile = client.phone;
  newClient.guide_category_id = getGuideCategory(client.category);

  console.log(`Tour Guide object: `, newClient);

  axios
    .post(`${process.env.URL}/api/v1/ttlb-tour-guides`, newClient, {
      headers,
    })
    .then((response) => {
      if (response?.data.data.first_name) {
        console.log(
          `Tour Guide ${response.data.data.first_name} ${response.data.data.middle_name} ${response.data.data.last_name} --- Created successfully...`
        );
        console.log(`Created Tour Guide: `, response.data.data);

        tour_guide_id = response.data.data.id;

        //------Approve Tour Guide-------
        approveTourGuide();
      } else {
        console.log(`Tour Guide ${_client} NOT created!`);
      }
    })
    .catch((error) => {
      console.error(
        "Tour Guide error:",
        error.response?.data.message || error.response?.data || error
      );
    });
}

function approveTourGuide() {
  console.log();
  console.log(
    `STEP 6: Tour Guide Approve ${first_name_arg} ${middle_name_arg} ${last_name_arg} .... `
  );
  console.log();
  axios
    .get(
      `${process.env.URL}/api/v1/ttlb-tour-guides/${tour_guide_id}/approve`,
      {
        headers,
      }
    )
    .then((response) => {
      if (response?.data.data) {
        console.log(
          `Tour Guide Approve ${first_name_arg} ${middle_name_arg} ${last_name_arg} --- Approved Successfully....`
        );

        //Create Tour GUide license
        createTourGuideLicense();
      } else {
        console.error("Tour Guide Approve Not Approve!");
      }
    })
    .catch((error) => {
      console.error(
        "Tour Guide Approve error:",
        error.response?.data.message || error.response?.data || error
      );
    });
}

async function createTourGuideLicense() {
  console.log();
  console.log(
    `STEP 7: Create Tour Guide License ${first_name_arg} ${middle_name_arg} ${last_name_arg} .... `
  );
  console.log();

  //--- create License
  if (license_year == "2025") {
    //--- check if license id
    const dup = await dblocal
      .raw(`select * from ttlb_tour_guide_license where id = ?`, [
        client.license_number,
      ])
      .then((r) => r.rows);

    if (dup.length != 0) {
      console.log(
        `Create Tour Guide License ${first_name_arg} ${middle_name_arg} ${last_name_arg} .... LICENSE EXIST!`
      );
      process.exit();
    } else {
      //--- Create License
      const l = {
        id: client.license_number,
        bill_group_id: -1,
        issied_date: "2025-01-01 00:00:00",
        expiry_date: "2025-12-31 00:00:00",
        year: 2025,
        status: 0,
        ttlb_tour_guide_id: tour_guide_id,
        created_at: "2025-01-01 00:00:00",
        updated_at: nowFormatted,
      };

      console.log(`Create Tour Guide License object: `, l);

      const wr = await dblocal("ttlb_tour_guide_license")
        .insert(l)
        .catch((error) => {
          console.log(
            "Create Tour Guide License error:",
            error || error.response?.data
          );
        });

      if (wr?.rowCount != 1) {
        console.log(`Create Tour Guide License ---- Insert ERROR`);
      } else {
        console.log(`Tour Guide License Successfully Created ---- DONE!`);
        console.log();
        console.log(`*************** ALL SUCCESSFULL **************`);
        console.log();
        console.log();
        process.exit();
      }
    }
  } else {
    console.log(
      `Year: ${license_year} License Number: ${client.license_number}  Tour Guide ID: ${tour_guide_id}`
    );
  }
}

function getGuideCategory(_name) {
  const categories = [
    {
      id: 4,
      name: "Cultural",
      created_at: "2020-08-06 13:06:58",
      updated_at: "2020-08-06 13:06:58",
      ttlb_registration_fee_group_id: 125,
      for_homestay: false,
    },
    {
      id: 3,
      name: "General",
      created_at: "2020-08-06 13:06:34",
      updated_at: "2020-08-06 13:06:34",
      ttlb_registration_fee_group_id: 125,
      for_homestay: false,
    },
    {
      id: 2,
      name: "Mountain Climbing",
      created_at: "2020-07-24 12:12:32",
      updated_at: "2020-07-24 12:12:32",
      ttlb_registration_fee_group_id: 125,
      for_homestay: false,
    },
    {
      id: 1,
      name: "Wildlife Safari",
      created_at: "2020-07-24 12:12:13",
      updated_at: "2020-08-06 13:00:31",
      ttlb_registration_fee_group_id: 125,
      for_homestay: false,
    },
  ];

  const result = categories.find(
    (category) => category.name.toLowerCase() === _name.toLowerCase()
  );

  return result.id;
}
