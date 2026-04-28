import axios from "axios";
import Table from "cli-table3";
import ora from "ora";
import { getValidToken } from "./auth";

import { API_URL, loadCredentials } from "./config";

async function getHeaders() {
  const creds = loadCredentials();
  if (!creds) throw new Error("Not logged in. Run: insighta login");
  return {
    Authorization: `Bearer ${creds.access_token}`,
    "X-API-Version": "1",
  };
}

export async function listProfiles(options: any) {
  const spinner = ora("Fetching profiles...").start();
  try {
    const params: any = {};
    if (options.gender) params.gender = options.gender;
    if (options.country) params.country_id = options.country;
    if (options.ageGroup) params.age_group = options.ageGroup;
    if (options.minAge) params.min_age = options.minAge;
    if (options.maxAge) params.max_age = options.maxAge;
    if (options.sortBy) params.sort_by = options.sortBy;
    if (options.order) params.order = options.order;
    if (options.page) params.page = options.page;
    if (options.limit) params.limit = options.limit;

    const headers = await getHeaders();
    const res = await axios.get(`${API_URL}/profiles`, { params, headers });
    spinner.stop();

    const { data, total, page, limit, total_pages } = res.data;

    const table = new Table({
      head: ["Name", "Gender", "Age", "Age Group", "Country"],
    });

    data.forEach((p: any) => {
      table.push([p.name, p.gender, p.age, p.age_group, p.country_name]);
    });

    console.log(table.toString());
    console.log(`\nPage ${page} of ${total_pages} | Total: ${total} profiles`);
  } catch (e: any) {
    spinner.stop();
    console.error("Error:", e.response?.data?.message || e.message);
  }
}

export async function searchProfiles(query: string, options: any) {
  const spinner = ora("Searching...").start();
  try {
    const headers = await getHeaders();
    const res = await axios.get(`${API_URL}/profiles/search`, {
      params: { q: query, page: options.page, limit: options.limit },
      headers,
    });
    spinner.stop();

    const { data, total } = res.data;

    const table = new Table({
      head: ["Name", "Gender", "Age", "Age Group", "Country"],
    });

    data.forEach((p: any) => {
      table.push([p.name, p.gender, p.age, p.age_group, p.country_name]);
    });

    console.log(table.toString());
    console.log(`\nTotal: ${total} results`);
  } catch (e: any) {
    spinner.stop();
    console.error("Error:", e.response?.data?.message || e.message);
  }
}

export async function createProfile(name: string) {
  const spinner = ora(`Creating profile for "${name}"...`).start();
  try {
    const headers = await getHeaders();
    const res = await axios.post(`${API_URL}/profiles`, { name }, { headers });
    spinner.stop();
    console.log("Profile created:");
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch (e: any) {
    spinner.stop();
    console.error("Error:", e.response?.data?.message || e.message);
  }
}

export async function exportProfiles(options: any) {
  const spinner = ora("Exporting profiles...").start();
  try {
    const params: any = { format: "csv" };
    if (options.gender) params.gender = options.gender;
    if (options.country) params.country_id = options.country;

    const headers = await getHeaders();
    const res = await axios.get(`${API_URL}/profiles/export`, {
      params,
      headers,
      responseType: "text",
    });
    spinner.stop();

    const fs = require("fs");
    const filename = `profiles_${Date.now()}.csv`;
    fs.writeFileSync(filename, res.data);
    console.log(`Exported to ${filename}`);
  } catch (e: any) {
    spinner.stop();
    console.error("Error:", e.response?.data?.message || e.message);
  }
}
