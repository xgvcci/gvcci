const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    ChannelType, 
    PermissionsBitField, 
    EmbedBuilder 
} = require('discord.js');
const config = require('./config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Déployer la commande slash /presence
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log('⏳ Déploiement de la commande /presence...');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            {
                body: [
                    new SlashCommandBuilder()
                        .setName('presence')
                        .setDescription('Créer un appel de présence avec date et heure.')
                        .addStringOption(option =>
                            option.setName('date')
                                .setDescription('Date de l\'événement (ex: 27/04/2025)')
                                .setRequired(true))
                        .addStringOption(option =>
                            option.setName('heure')
                                .setDescription('Heure de l\'événement (ex: 19:30)')
                                .setRequired(true))
                        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
                        .toJSON()
                ]
            }
        );

        console.log('✅ Commande /presence déployée avec succès.');
    } catch (error) {
        console.error(error);
    }
})();

client.once('ready', async () => {
    console.log(`✅ Connecté en tant que ${client.user.tag}`);

    const ticketButton = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('open_ticket')
                .setLabel('🎫 Ouvrir un ticket')
                .setStyle(ButtonStyle.Primary),
        );

    const channel = await client.channels.fetch(config.ticketChannelId);
    if (channel) {
        await channel.send({ 
            content: 'Cliquez sur le bouton ci-dessous pour ouvrir un ticket :', 
            components: [ticketButton] 
        });
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'open_ticket') {
            const categoryMenu = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('select_category')
                        .setPlaceholder('Choisissez une catégorie')
                        .addOptions(Object.entries(config.categories).map(([key, name]) => ({
                            label: name,
                            value: key
                        })))
                );

            await interaction.reply({ 
                content: 'Sélectionnez la catégorie de votre ticket :', 
                components: [categoryMenu], 
                ephemeral: true 
            });
        }

        if (interaction.customId === 'close_ticket') {
            await interaction.channel.send('🔒 Fermeture du ticket dans 5 secondes...');
            setTimeout(() => interaction.channel.delete(), 5000);
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_category') {
            const category = interaction.values[0];
            const guild = interaction.guild;
            const member = interaction.user;

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${member.username}`.toLowerCase(),
                    type: ChannelType.GuildText,
                    parent: config.ticketCategoryId,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: [PermissionsBitField.Flags.ViewChannel],
                        },
                        {
                            id: member.id,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.AttachFiles,
                                PermissionsBitField.Flags.ReadMessageHistory,
                            ],
                        },
                        {
                            id: config.staffRoleId,
                            allow: [
                                PermissionsBitField.Flags.ViewChannel,
                                PermissionsBitField.Flags.SendMessages,
                                PermissionsBitField.Flags.ReadMessageHistory,
                            ],
                        },
                    ],
                });

                const closeButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('❌ Fermer le ticket')
                            .setStyle(ButtonStyle.Danger),
                    );

                await ticketChannel.send({
                    content: `👋 Bonjour ${member}, merci d'avoir ouvert un ticket pour **${config.categories[category]}**.`,
                    components: [closeButton],
                });

                await interaction.reply({ content: `✅ Votre ticket a été créé ici : ${ticketChannel}`, ephemeral: true });

            } catch (error) {
                console.error('❌ Erreur lors de la création du ticket :', error);
                await interaction.reply({ content: '❌ Une erreur est survenue en créant votre ticket.', ephemeral: true });
            }
        }
    }

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'presence') {
            const date = interaction.options.getString('date');
            const heure = interaction.options.getString('heure');
            const roleMention = `<@&${config.roleToMentionId}>`;
            const targetChannel = await client.channels.fetch(config.presenceChannelId);

            const embed = new EmbedBuilder()
                .setTitle(`📅 Présence pour le ${date} à ${heure}`)
                .setDescription('Répondez avec ✅ (Présent), ❌ (Absent), ou ⏳ (Retard)')
                .setColor(0x00AE86)
                .setTimestamp();

            const message = await targetChannel.send({
                content: `${roleMention}`,
                embeds: [embed],
            });

            try {
                await message.react('✅');
                await message.react('❌');
                await message.react('⏳');
                await interaction.reply({ content: '✅ Appel de présence envoyé.', ephemeral: true });
            } catch (error) {
                console.error('Erreur en ajoutant les réactions :', error);
                await interaction.reply({ content: '❌ Impossible d\'ajouter les réactions.', ephemeral: true });
            }
        }
    }
});

client.login(config.token);