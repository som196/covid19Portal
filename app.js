const express = require("express");
const app = express();
app.use(express.json());
module.exports = app;
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const bcrypt = require("bcrypt");
const intializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
intializeDBAndServer();

//Middleware function
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authorizationHeader = request.headers["authorization"];

  if (authorizationHeader !== undefined) {
    jwtToken = authorizationHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//login
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}';`;
  const returnedUser = await db.get(selectUser);
  if (returnedUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const doesPasswordMatch = await bcrypt.compare(
      password,
      returnedUser.password
    );
    if (doesPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

function convertStateCase(each) {
  return {
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  };
}

function convertDistrictCase(each) {
  return {
    districtId: each.district_id,
    districtName: each.district_name,
    stateId: each.state_id,
    cases: each.cases,
    cured: each.cured,
    active: each.active,
    deaths: each.deaths,
  };
}

//API1 Returns all states
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT * FROM state`;
  let dbResponse = await db.all(statesQuery);
  response.send(dbResponse.map((eachPlayer) => convertStateCase(eachPlayer)));
});

//API2 Returns a state based on the state ID

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state where state_id=${stateId};`;
  const dbResponse = await db.get(getStateQuery);
  response.send(convertStateCase(dbResponse));
});

//API3 Create a district in the district table, district_id is auto-incremented
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const insertDistrictQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
    VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

//API4 Returns a district based on the district ID
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district where district_id=${districtId};`;
    const dbResponse = await db.get(getDistrictQuery);
    response.send(convertDistrictCase(dbResponse));
  }
);

//API5 Deletes a district from the district table
//based on the district ID

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district where
    district_id=${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//API6 Updates the details of a specific district based on the district ID

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `UPDATE district SET
    district_name='${districtName}',state_id=${stateId},
    cases=${cases},cured=${cured},active=${active},deaths=${deaths}
    WHERE district_id=${districtId}`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API7 Returns the statistics of total cases, cured, active, deaths of a
//specific state based on state ID

//response.send(moviesArray.map(
//(eachMovie) => ({ movieName: eachMovie.movie_name }))

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const returnStatsQuery = `SELECT SUM(cases),
  SUM(cured), SUM(active),
  SUM(deaths) FROM district WHERE
    state_id=${stateId};`;
    const dbResponse = await db.get(returnStatsQuery);
    response.send({
      totalCases: dbResponse["SUM(cases)"],
      totalCured: dbResponse["SUM(cured)"],
      totalActive: dbResponse["SUM(active)"],
      totalDeaths: dbResponse["SUM(deaths)"],
    });
  }
);

//API8 Returns an object containing the state name of a district based
// on the district ID
//INNER JOIN?
app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateNameQuery = `SELECT state_name FROM
  district LEFT JOIN
   state
    ON
    district.state_id=state.state_id
    WHERE
    district_id=${districtId};`;
    const district1 = await db.get(getStateNameQuery);
    response.send({ stateName: district1.state_name });
  }
);
