require("dotenv").config();
const dblocal = require("./db").pg(
  process.env.DB_DATABASE_NAME,
  process.env.DB_HOST,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  console
);

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

//--------- guide details -------
var license_number = 22895;
var tour_guide_id = 4209;
var start_data = "2023-01-01 00:00:00";

const l = {
  id: license_number,
  bill_group_id: -1,
  issied_date: start_data,
  expiry_date: "2023-12-31 23:59:59",
  year: 2023,
  status: 0,
  ttlb_tour_guide_id: tour_guide_id,
  created_at: start_data,
  updated_at: nowFormatted,
};

licensingGuide();

async function licensingGuide() {
  console.log(`STEP 4: Create Tour Guide License.... `);
  console.log();

  //--- check if license id
  const dup = await dblocal
    .raw(`select * from ttlb_tour_guide_license where id = ?`, [license_number])
    .then((r) => r.rows);

  if (dup.length != 0) {
    console.log(`Create Tour Guide License ---- License ID exists!`);
    process.exit();
  } else {
    //--- Create License

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
      console.log(`License Successfull ---- CREATED`);
      console.log();
    }
    process.exit();
  }
}
