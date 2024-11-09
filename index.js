import { Octokit } from "octokit";
import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error("Please set GITHUB_TOKEN and GITHUB_REPO in your .env file");
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Helper function to get milestone number from name
const getMilestoneNumber = async (milestoneName) => {
  const [owner, repo] = GITHUB_REPO.split("/");
  try {
    const { data: milestones } = await octokit.rest.issues.listMilestones({
      owner,
      repo,
    });

    const milestone = milestones.find((m) => m.title === milestoneName);
    return milestone ? milestone.number : undefined;
  } catch (error) {
    console.error(`Error getting milestone: ${milestoneName}`, error);
    return undefined;
  }
};

// Function to create a single issue
const createIssue = async (issueContent) => {
  const [owner, repo] = GITHUB_REPO.split("/");

  try {
    // Parse the issue content
    const lines = issueContent.trim().split("\n");
    const title = lines[0];

    // Extract labels
    const labelsMatch = issueContent.match(/Labels: (.+)/);
    const labels = labelsMatch ? labelsMatch[1].split(", ") : [];

    // Extract milestone
    const milestoneMatch = issueContent.match(/Milestone: (.+)/);
    const milestone = milestoneMatch
      ? await getMilestoneNumber(milestoneMatch[1])
      : null;

    // Create the issue
    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body: issueContent,
      labels,
      milestone,
    });

    console.log(`✅ Created issue: ${title}`);
    console.log(`   URL: ${response.data.html_url}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create issue: ${title}`);
    console.error(`   Error: ${error.message}`);
    return null;
  }
};

// Function to read and parse markdown files
const processMarkdownFiles = async () => {
  try {
    // Read all files from the markdown directory
    const markdownDir = path.join(process.cwd(), "markdown");
    const files = await fs.readdir(markdownDir);
    const markdownFiles = files.filter((file) => file.endsWith(".md"));

    console.log(`Found ${markdownFiles.length} markdown files to process...`);

    // Process each file
    for (const file of markdownFiles) {
      console.log(`\nProcessing ${file}...`);

      // Read file content
      const content = await fs.readFile(path.join(markdownDir, file), "utf8");

      // Split content into individual issues
      const issues = content.split("## ").filter(Boolean);

      console.log(`Found ${issues.length} issues in ${file}`);

      // Create each issue
      for (const issue of issues) {
        await createIssue(issue);
        // Add a small delay to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log("\n✨ All issues have been processed!");
  } catch (error) {
    console.error("Error processing markdown files:", error);
    process.exit(1);
  }
};

// Main execution
console.log("Starting GitHub issue creation process...");
processMarkdownFiles()
  .then(() => {
    console.log("Process completed successfully!");
  })
  .catch((error) => {
    console.error("Process failed:", error);
    process.exit(1);
  });
