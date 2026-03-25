# Label Studio Setup on GCP

This guide walks you through deploying Label Studio on a GCP VM and configuring it to label crawled Markdown files from the `law-firm-knowledge-base` bucket.

---

## Step 1: Create a GCP VM

Run this from your local terminal (where you have `gcloud` installed):

```bash
# Create the VM (e2-medium: 2 vCPU, 4 GB RAM)
gcloud compute instances create label-studio-vm \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --zone=us-central1-a \
    --boot-disk-size=20GB \
    --tags=label-studio-server

# Open port 8080 so you can access the Label Studio UI
gcloud compute firewall-rules create allow-label-studio \
    --allow=tcp:8080 \
    --target-tags=label-studio-server \
    --description="Allow Label Studio web UI access"
```

**What this does:**
- Creates a small VM running Ubuntu 22.04
- Opens port 8080 on the firewall so you can reach Label Studio from your browser

---

## Step 2: SSH Into the VM

```bash
gcloud compute ssh label-studio-vm --zone=us-central1-a
```

---

## Step 3: Install Label Studio

Once you're SSH'd into the VM, run:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Python 3 and pip
sudo apt install -y python3 python3-pip python3-venv

# Create a virtual environment
python3 -m venv ~/label-studio-env
source ~/label-studio-env/bin/activate

# Install Label Studio
pip install label-studio

# Start Label Studio
label-studio start --port 8080
```

**What this does:**
- Installs Python and Label Studio in an isolated virtual environment
- Starts the Label Studio web server on port 8080

**First time:** Label Studio will ask you to create an account. Pick any email/password — this is just for your local instance.

---

## Step 4: Access the Label Studio UI

1. Get your VM's external IP:
   ```bash
   gcloud compute instances describe label-studio-vm \
       --zone=us-central1-a \
       --format="get(networkInterfaces[0].accessConfigs[0].natIP)"
   ```

2. Open your browser and go to: `http://YOUR_VM_IP:8080`

3. Create your account and log in.

---

## Step 5: Create a New Project

1. Click **"Create Project"**
2. Name it: `Law Firm Knowledge Base Labeling`
3. Skip the data import step for now (we'll connect GCS next)

---

## Step 6: Set Up the Labeling Template

1. Go to **Project Settings → Labeling Interface**
2. Click **"Code"** to switch to the XML editor
3. Paste this template:

```xml
<View>
  <Header value="Classify this legal content chunk:" />
  <Text name="text" value="$text" />
  <Choices name="category" toName="text" choice="multiple">
    <Choice value="visa-info" />
    <Choice value="eligibility" />
    <Choice value="process" />
    <Choice value="fees" />
    <Choice value="timeline" />
    <Choice value="other" />
  </Choices>
</View>
```

4. Click **"Save"**

**What the labels mean:**
- **visa-info** — General information about visa types, categories, descriptions
- **eligibility** — Who qualifies, requirements, conditions
- **process** — Steps to apply, procedures, forms needed
- **fees** — Costs, filing fees, payment methods
- **timeline** — Processing times, wait periods, deadlines
- **other** — Anything that doesn't fit the above categories

**Note:** `choice="multiple"` means a single chunk can have more than one label (e.g., a paragraph might cover both "process" and "timeline").

---

## Step 7: Connect GCS as Source Storage

This tells Label Studio to pull crawled Markdown files from your GCS bucket.

### Create a Service Account Key

On your **local machine** (not the VM), run:

```bash
# Create a service account for Label Studio
gcloud iam service-accounts create label-studio-sa \
    --display-name="Label Studio Service Account"

# Grant it access to your bucket
gcloud storage buckets add-iam-policy-binding gs://law-firm-knowledge-base \
    --member="serviceAccount:label-studio-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

# Download the key file
gcloud iam service-accounts keys create ~/label-studio-key.json \
    --iam-account=label-studio-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

Replace `YOUR_PROJECT_ID` with your actual GCP project ID.

### Upload the Key to the VM

```bash
gcloud compute scp ~/label-studio-key.json label-studio-vm:~/label-studio-key.json \
    --zone=us-central1-a
```

### Configure Source Storage in Label Studio

1. In the Label Studio UI, go to **Project Settings → Cloud Storage**
2. Click **"Add Source Storage"**
3. Fill in:
   - **Storage type:** Google Cloud Storage
   - **Bucket:** `law-firm-knowledge-base`
   - **Prefix:** *(leave empty — reads all .md files from the root)*
   - **File filter regex:** `.*\.md$`
   - **Google Application Credentials:** paste the contents of `label-studio-key.json`
   - **Treat every bucket object as a source file:** checked
4. Click **"Check Connection"** to verify, then **"Add Storage"**
5. Click **"Sync Storage"** to pull in the crawled Markdown files

---

## Step 8: Connect GCS as Target Storage (Export)

This tells Label Studio where to save the labeled results.

1. In **Project Settings → Cloud Storage**, click **"Add Target Storage"**
2. Fill in:
   - **Storage type:** Google Cloud Storage
   - **Bucket:** `law-firm-knowledge-base`
   - **Prefix:** `labeled/`
   - **Google Application Credentials:** paste the same key contents
3. Click **"Check Connection"**, then **"Add Storage"**

---

## Step 9: Label Your Data

1. Go back to the project dashboard
2. Click on any task to start labeling
3. Read each Markdown chunk and select the appropriate categories
4. Click **"Submit"** after each annotation

**Tips:**
- You can assign multiple labels to a single chunk
- Use keyboard shortcuts for speed (shown in the bottom bar)
- Label in batches — even 50 labeled chunks is enough to start testing the RAG pipeline

---

## Step 10: Export Labeled Data

After labeling, sync the target storage to push annotations to GCS:

1. Go to **Project Settings → Cloud Storage**
2. Under Target Storage, click **"Sync Storage"**
3. Verify the export: on your local machine, run:
   ```bash
   gcloud storage ls gs://law-firm-knowledge-base/labeled/
   ```
   You should see JSON files containing your annotations.

---

## Running Label Studio as a Background Service (Optional)

To keep Label Studio running after you disconnect from SSH:

```bash
# SSH into the VM
gcloud compute ssh label-studio-vm --zone=us-central1-a

# Create a systemd service
sudo tee /etc/systemd/system/label-studio.service > /dev/null <<EOF
[Unit]
Description=Label Studio
After=network.target

[Service]
User=$USER
WorkingDirectory=/home/$USER
ExecStart=/home/$USER/label-studio-env/bin/label-studio start --port 8080
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable label-studio
sudo systemctl start label-studio

# Check it's running
sudo systemctl status label-studio
```

---

## Troubleshooting

- **Can't reach the UI?** Check that the firewall rule exists: `gcloud compute firewall-rules list --filter="name=allow-label-studio"`
- **Storage sync fails?** Verify the service account key has `storage.objectAdmin` permissions on the bucket
- **VM ran out of memory?** Restart Label Studio: `sudo systemctl restart label-studio`
