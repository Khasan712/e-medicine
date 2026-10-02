"""aiogram filters that read messages the way the bots always did: commands only in the text (not in captions),
in any case and with "@botname" ignored; keyboard buttons matched by their label."""
from aiogram.filters import Filter
from aiogram.types import CallbackQuery, Message


def parse_command(text):
    """'/start@my_bot inv_x' -> ('/start', 'inv_x'); not a command -> ('', '')."""
    if not text.startswith('/'):
        return '', ''
    command, _, argument = text.partition(' ')
    return command.split('@')[0].lower(), argument.strip()


class TextCommand(Filter):
    """/command at the start of a text message. The handler gets the rest of the text as `argument`;
    with `prefix`, the argument must start with it (deep links: "/start inv_...")."""

    def __init__(self, *commands, prefix=None):
        self.commands = {f'/{command}' for command in commands}
        self.prefix = prefix

    async def __call__(self, message: Message):
        command, argument = parse_command((message.text or '').strip())
        if command not in self.commands or (self.prefix is not None and not argument.startswith(self.prefix)):
            return False
        return {'argument': argument}


class TextIs(Filter):
    """The text is one of `labels` (reply keyboard buttons, in any language)."""

    def __init__(self, labels):
        self.labels = set(labels)

    async def __call__(self, message: Message):
        return (message.text or '').strip() in self.labels


class PlainText(Filter):
    """Text that is not a command. The handler gets it stripped as `text`."""

    async def __call__(self, message: Message):
        text = (message.text or '').strip()
        return {'text': text} if text and not text.startswith('/') else False


class CallbackKind(Filter):
    """Callback data "<kind>:<rest>". The handler gets `rest`."""

    def __init__(self, kind):
        self.kind = kind

    async def __call__(self, query: CallbackQuery):
        kind, _, rest = (query.data or '').partition(':')
        return {'rest': rest} if kind == self.kind else False
