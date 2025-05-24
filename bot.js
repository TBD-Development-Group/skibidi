const { Client, GatewayIntentBits } = require('discord.js');
const encoder = require('./encoder'); // Your provided encoder module
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check for file attachments
    if (message.attachments.size > 0) {
        const attachment = message.attachments.first();
        
        try {
            // Download the file
            const response = await fetch(attachment.url);
            const fileContent = await response.text();
            
            // Encode the content using your encoder
            const encodedContent = encoder.from_string(fileContent);
            
            // Send back the encoded content
            // If it's too long, create a file attachment
            if (encodedContent.length > 2000) {
                fs.writeFileSync('encoded_output.txt', encodedContent);
                await message.reply({
                    content: 'Here is your encoded file:',
                    files: ['encoded_output.txt']
                });
                fs.unlinkSync('encoded_output.txt');
            } else {
                await message.reply(`Encoded content:\n\`\`\`\n${encodedContent}\n\`\`\``);
            }
        } catch (error) {
            console.error('Error processing file:', error);
            await message.reply('An error occurred while processing your file.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
