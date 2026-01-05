import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'src/components/admin/CreateEditInvestorDialog.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `  useEffect(() => {
    if (investor) {
      setFormData({
        name: investor.profiles?.name || "",
        email: investor.profiles?.email || "",`;

const newCode = `  useEffect(() => {
    if (investor) {
      const profile = investor.profile || investor.profiles;
      setFormData({
        name: profile?.name || "",
        email: profile?.email || "",`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✓ File updated successfully');
} else {
  console.log('✗ Old code pattern not found');
  if (content.includes('investor.profiles?.name')) {
    console.log('Found investor.profiles?.name - pattern might be slightly different');
  }
}
