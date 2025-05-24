const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');
const luamin = require('./luamin.js');

// Discord bot setup
const client = new Discord.Client({
    intents: [
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.MessageContent
    ]
});

// Configuration
const config = {
    prefix: '!',
    allowedChannels: [], // Add channel IDs here to restrict usage
    adminRoles: [] // Add role IDs here for admin-only commands
};

// File paths
const INPUT_FILE = path.join(__dirname, 'input.lua');
const OUTPUT_FILE = path.join(__dirname, 'dumped.lua');

// Bot ready event
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Bot started in ${Math.round(process.uptime())} seconds`);
});

// Message handler
client.on('messageCreate', async message => {
    // Ignore bots and messages without prefix
    if (message.author.bot || !message.content.startsWith(config.prefix)) return;

    // Check if channel is allowed (if configured)
    if (config.allowedChannels.length > 0 && !config.allowedChannels.includes(message.channel.id)) {
        return message.reply('This command cannot be used in this channel.');
    }

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'deobfuscate') {
        await handleDeobfuscateCommand(message, args);
    } else if (command === 'help') {
        showHelp(message);
    }
});

// Command handlers
async function handleDeobfuscateCommand(message, args) {
    // Check for attached file
    if (message.attachments.size === 0) {
        return message.reply('Please attach a Lua file to deobfuscate.');
    }

    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.lua')) {
        return message.reply('The attached file must be a Lua script (.lua extension).');
    }

    try {
        // Show processing message
        const processingMsg = await message.reply('Processing Lua file... This may take a moment.');

        // Download the file
        const response = await fetch(attachment.url);
        const luaCode = await response.text();

        // Save to input file
        fs.writeFileSync(INPUT_FILE, luaCode);

        // Start processing
        const startTime = Date.now();
        await processLuaFile();

        // Read the result
        const result = fs.readFileSync(OUTPUT_FILE, 'utf8');

        // Send the result
        await message.reply({
            content: `Deobfuscation completed in ${(Date.now() - startTime) / 1000} seconds.`,
            files: [{
                attachment: OUTPUT_FILE,
                name: 'deobfuscated.lua'
            }]
        });

        // Delete processing message
        await processingMsg.delete().catch(console.error);
    } catch (error) {
        console.error('Deobfuscation error:', error);
        message.reply(`An error occurred during deobfuscation: ${error.message}`);
    }
}

function showHelp(message) {
    const embed = new Discord.EmbedBuilder()
        .setTitle('Lua Deobfuscator Bot Help')
        .setDescription('A bot for deobfuscating Lua scripts')
        .addFields(
            { name: 'Commands', value: '`!deobfuscate` - Deobfuscate an attached Lua file\n`!help` - Show this help message' },
            { name: 'Usage', value: 'Attach a Lua file and use `!deobfuscate` to process it' },
            { name: 'Support', value: '[Support Server](https://discord.gg/SXQvSGme7F)' }
        )
        .setColor('#0099ff');

    message.reply({ embeds: [embed] });
}

// Lua processing functions
async function processLuaFile() {
    console.log('Renaming variables of the script...');
    luamin.minify(false);

    try {
        const input = fs.readFileSync(INPUT_FILE, 'utf8');
        const header = '-- [BYFRON] : Byfron Moonsec V3 Beta Dumper @ https://discord.gg/SXQvSGme7F\nthingbytecode="";\n';
        fs.writeFileSync(OUTPUT_FILE, header + input);

        const newInput = fs.readFileSync(OUTPUT_FILE, 'utf8');
        const matches = newInput.match(/local function (.)\(.\)return (.)\[.\]end/m);

        if (!matches) {
            throw new Error('No matching patterns found in the Lua code.');
        }

        let functionBc = matches[0];
        let newFunction = functionBc.replace(
            /return (.)\[(.)\]/m,
            (match, p1, p2) => {
                const cacheMatch = functionBc.match(/(.)\[(.)\]/m)[0];
                return `thingbytecode=thingbytecode..${cacheMatch}return ${cacheMatch}`;
            }
        );

        let updatedInput = newInput.replace(functionBc, newFunction);
        const matchThing = updatedInput.match(/if (.)~=(.) then local (.)=(.);/m);

        if (matchThing && matchThing[0]) {
            const injection = matchThing[0] + 
                "thingbytecode2=thingbytecode:match('MoonSec_StringsHiddenAttr(.+)');" +
                "print('output 1:\\n');print(thingbytecode);" +
                "print('\\noutput 2:\\n');print(thingbytecode2);";
            updatedInput = updatedInput.replace(matchThing[0], injection);
        }

        fs.writeFileSync(OUTPUT_FILE, updatedInput);
        console.log('Successfully wrote deobfuscation modifications.');
    } catch (error) {
        console.error('Lua processing error:', error);
        throw error;
    }
}

// Start the bot
client.login(process.env.DISCORD_TOKEN);
