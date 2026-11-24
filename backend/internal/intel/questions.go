package intel

import (
	"slices"
	"strings"
	"unicode"
)

var assistantReplies = map[string]string{
	"greeting":     "Hello! I can help you analyze transfers, investigate flagged patterns, and use FFBI. What would you like to check?",
	"identity":     "I'm the FFBI AI Investigator. I can help explain transfers, risk indicators, and how to use the platform.",
	"small-talk":   "I'm ready to help. Ask me about FFBI, a transfer route, or a flagged pattern.",
	"thanks":       "You're welcome. Let me know if you want to review another transfer or finding.",
	"product-help": "FFBI analyzes imported bank transfers. You can explore the financial graph, review flagged patterns and their evidence, and export a case report.",
	"import-help":  "Open Data Sources, select a CSV or JSON file, and choose Import and analyze. The file can contain up to 2,000 transfers. Open File format there to see the required fields.",
	"report-help":  "Open Anomaly Radar, select a finding, and create a case in Investigation Workspace. Open the case and choose PDF or JSON to download the report.",
	"graph-help":   "Open Universe Explorer to inspect the financial graph. Select an account or a transfer to see its details. Use Money Flow Stories to follow transfers in order.",
	"risk-help":    "Anomaly Radar lists patterns flagged in the imported ledger. Open a finding to see the rule, the observed conditions, and links to the transfers.",
	"links-help":   "Open Relationship Discovery and select an account to review possible connections and supporting records. Transfer imports can reveal shared counterparties.",
	"clarify":      "Could you be more specific? Try asking for a route between two account IDs, the number of imported transfers, or the reason a selected account was flagged.",
	"out-of-scope": "That question is outside what FFBI covers. I can help with bank transfers, flagged patterns, account links, and using the platform.",
}

func GuessIntent(question string) string {
	normalized := strings.ReplaceAll(strings.ToLower(question), "ё", "е")
	words := strings.FieldsFunc(normalized, func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsNumber(r) })
	text := " " + strings.Join(words, " ") + " "
	has := func(phrases ...string) bool {
		return slices.ContainsFunc(phrases, func(phrase string) bool { return strings.Contains(text, " "+phrase+" ") })
	}
	starts := func(stems ...string) bool {
		return slices.ContainsFunc(words, func(word string) bool {
			return slices.ContainsFunc(stems, func(stem string) bool { return strings.HasPrefix(word, stem) })
		})
	}
	exact := func(phrases ...string) bool { return slices.Contains(phrases, strings.TrimSpace(text)) }

	switch {
	case has("how are you", "как дела", "как у тебя дела", "қалың қалай", "қалайсың", "жағдайың қалай"):
		return "small-talk"
	case has("what is your name", "what s your name", "who are you", "как тебя зовут", "как вас зовут", "кто ты", "кто вы", "сен кімсің", "атың кім", "есімің кім"):
		return "identity"
	case exact("hi", "hello", "hey", "good morning", "good afternoon", "привет", "здравствуйте", "добрый день", "доброе утро", "сәлем", "сәлеметсіз бе", "қайырлы күн"):
		return "greeting"
	case exact("thanks", "thank you", "спасибо", "благодарю", "рақмет", "рахмет", "көп рақмет"):
		return "thanks"
	}

	data := has("csv", "json", "data sources", "ledger", "export", "реестр", "выгрузку", "деректер", "тізілім") ||
		starts("upload", "import", "загруз", "импорт", "выгруз", "жүкт", "дереккөз")
	transfer := starts("transfer", "transact", "перевод", "транзак", "операци", "аударым", "операция")
	account := starts("account", "counterpart", "счет", "контрагент", "шот")
	risk := starts("anomal", "finding", "аномали", "аномалия", "байқау") ||
		has("high risk", "почему риск", "неге тәуекел")
	money := has("money", "funds", "деньги", "денег", "средства", "средств", "ақша", "қаражат")
	help := has("how to", "how do i", "how can i", "where can i", "what is", "как", "где", "что такое", "қалай", "қайдан", "деген не", "дегеніміз не")
	product := has("ffbi", "this app", "this platform", "это приложение", "этот проект", "наш проект", "эта платформа", "бұл қолданба", "бұл жоба")
	report := starts("report", "отчет") || has("есеп", "есепті")
	route := starts("маршрут", "бағыт") || has("route", "path", "fastest")
	link := starts("relationship", "связ", "байланыс")
	count := has("how many", "сколько", "қанша", "неше")
	domain := transfer || account || risk || money

	switch {
	case has("who received the money", "where did the money go", "where did the funds go", "куда ушли деньги", "куда ушли средства", "кому ушли деньги", "кому перевели деньги", "ақша қайда кетті", "ақша кімге аударылды"):
		return "flow"
	case route && (domain || strings.Count(question, "-") >= 2 && starts("покаж", "найд", "find", "show", "acc", "test")):
		return "route"
	case count && risk:
		return "finding-count"
	case count && (transfer || account && (data || product)) && !has("over", "above", "below", "more than", "less than", "больше", "меньше", "свыше", "от", "арт", "астам", "вчера", "за", "today", "yesterday", "last", "during", "бүгін", "кеше"):
		if account && !data && !product {
			return "account-count"
		}
		return "ledger-count"
	case help && (report || has("pdf")) && (domain || product || has("export a report", "export the report", "скачать отчет", "выгрузить отчет", "экспортировать отчет", "есепті жүктеу") || exact("как скачать pdf", "как сделать отчет", "how to export pdf")):
		return "report-help"
	case help && (data && (domain || product || has("csv", "json", "data sources", "источники данных", "дереккөздер")) ||
		exact("как загрузить файл", "как загрузить данные", "как импортировать данные", "how to upload data", "how do i upload a file", "деректерді қалай жүктеймін", "файлды қалай жүктеймін")):
		return "import-help"
	case help && (has("universe explorer", "финансовая карта", "карта финансовой сети", "граф переводов", "схема сети", "қаржы желісінің картасы") || (product || domain) && has("graph", "граф", "карта", "карту") || exact("как открыть граф", "how to open the graph")):
		return "graph-help"
	case help && (link && (domain || product) || has("поиск связей", "relationship discovery")):
		return "links-help"
	case (help && risk || has("anomaly radar", "радар аномалий", "аномалиялар радары")) && !account:
		return "risk-help"
	case product || has("what can you do", "what do you do", "what can you help", "what is this project", "что ты умеешь", "что вы умеете", "что ты можешь", "чем ты можешь помочь", "что делает проект", "что делает приложение", "что делает сайт", "сен не істей аласың", "немен көмектесе аласың", "не істей аласың"):
		return "product-help"
	case domain && starts("circular", "cycle", "циклич", "кругов", "айналмал") || exact("find circular transactions"):
		return "cycles"
	case has("what changed in the last 24 hours", "что изменилось за последние 24 часа", "соңғы 24 сағатта не өзгерді") ||
		domain && (starts("changed", "изменил") || has("last 24", "последние 24", "соңғы 24")):
		return "changes"
	case account && (starts("risk", "риск", "тәуекел") || risk || has("почему этот счет отмечен", "why was this account flagged")):
		return "risk"
	case account && (starts("important", "важн", "центральн", "маңыз") || has("most connected")):
		return "important"
	case (account && link) || exact("show relationships", "покажи связи", "байланыстарды көрсет"):
		return "relationships"
	case report && (domain || exact("create a report", "make a report", "сделай отчет", "подготовь отчет", "есеп дайында")):
		return "report"
	case has("what is happening in this network", "что происходит в этой сети", "интерпретируй эту сеть", "осы желіде не болып жатыр") ||
		domain && has("explain", "объясни", "түсіндір"):
		return "explain"
	case transfer || account || risk:
		return "clarify"
	default:
		return "out-of-scope"
	}
}
