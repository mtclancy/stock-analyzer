import { google, sheets_v4 } from "googleapis";
import path from "path";
import { BaseExternalAccountClient } from 'google-auth-library';
import { GoogleAuth, JSONClient } from "google-auth-library/build/src/auth/googleauth";

const keyFilePath = path.join(__dirname, '..', 'credentials.json');
const auth: GoogleAuth<JSONClient> = new google.auth.GoogleAuth({
  keyFile: keyFilePath,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
    const client = await auth.getClient() as BaseExternalAccountClient;

    if(!client){
        throw new Error("no credentials")
    }
    const sheets = google.sheets({ version: "v4", auth: client });

    return sheets;
}