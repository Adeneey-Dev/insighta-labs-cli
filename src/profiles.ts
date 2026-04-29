import axios from "axios";
import Table from "cli-table3";
import ora from "ora";
import { getValidToken } from "./auth";
import { API_URL, loadCredentials } from "./config";

async function getHeaders() {
  try {
    const token = await getValidToken();
    return {
      Authorization: `Bearer ${token}`,
      "X-API-Version": "1",
    };
  } catch (e: any) {
    throw new Error(e.message);
  }
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
      style: { head: ["cyan"] },
    });

    data.forEach((p: any) => {
      table.push([
        p.name,
        p.gender,
        String(p.age),
        p.age_group,
        p.country_name,
      ]);
    });

    console.log(table.toString());
    console.log(`\nPage ${page} of ${total_pages} | Total: ${total} profiles`);
  } catch (e: any) {
    spinner.stop();
    console.error(" Error:", e.response?.data?.message || e.message);
  }
}

export async function searchProfiles(query: string, options: any) {
  const spinner = ora("Searching...").start();
  try {
    const headers = await getHeaders();
    const res = await axios.get(`${API_URL}/profiles/search`, {
      params: {
        q: query,
        page: options.page || 1,
        limit: options.limit || 10,
      },
      headers,
    });
    spinner.stop();

    const { data, total } = res.data;

    if (!data || data.length === 0) {
      console.log("No results found");
      return;
    }

    const table = new Table({
      head: ["Name", "Gender", "Age", "Age Group", "Country"],
      style: { head: ["cyan"] },
    });

    data.forEach((p: any) => {
      table.push([
        p.name,
        p.gender,
        String(p.age),
        p.age_group,
        p.country_name,
      ]);
    });

    console.log(table.toString());
    console.log(`\nTotal: ${total} results`);
  } catch (e: any) {
    spinner.stop();
    console.error(" Error:", e.response?.data?.message || e.message);
  }
}

export async function createProfile(name: string) {
  if (!name) {
    console.error(" Error: --name is required");
    return;
  }
  const spinner = ora(`Creating profile for "${name}"...`).start();
  try {
    const headers = await getHeaders();
    const res = await axios.post(`${API_URL}/profiles`, { name }, { headers });
    spinner.stop();
    console.log(" Profile created:");
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch (e: any) {
    spinner.stop();
    console.error(" Error:", e.response?.data?.message || e.message);
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
    console.log(` Exported to ${filename}`);
  } catch (e: any) {
    spinner.stop();
    console.error(" Error:", e.response?.data?.message || e.message);
  }
}
