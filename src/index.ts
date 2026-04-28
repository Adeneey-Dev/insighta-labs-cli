#!/usr/bin/env node
import { Command } from "commander";
import { login, logout, whoami } from "./auth";
import {
  listProfiles,
  searchProfiles,
  createProfile,
  exportProfiles,
} from "./profiles";

const program = new Command();

program.name("insighta").description("Insighta Labs CLI").version("1.0.0");

program.command("login").description("Login with GitHub").action(login);
program.command("logout").description("Logout").action(logout);
program.command("whoami").description("Show current user").action(whoami);

const profiles = program.command("profiles").description("Profile commands");

profiles
  .command("list")
  .option("--gender <gender>")
  .option("--country <country>")
  .option("--age-group <ageGroup>")
  .option("--min-age <minAge>")
  .option("--max-age <maxAge>")
  .option("--sort-by <sortBy>")
  .option("--order <order>")
  .option("--page <page>")
  .option("--limit <limit>")
  .action(listProfiles);

profiles
  .command("search <query>")
  .option("--page <page>")
  .option("--limit <limit>")
  .action(searchProfiles);

profiles
  .command("create")
  .option("--name <name>")
  .action((options) => createProfile(options.name));

profiles
  .command("export")
  .option("--format <format>", "csv")
  .option("--gender <gender>")
  .option("--country <country>")
  .action(exportProfiles);

program.parse(process.argv);
