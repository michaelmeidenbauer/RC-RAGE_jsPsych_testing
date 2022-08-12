/**
 * rc-rage_main.js
 * Kyoung Whan Choe (https://github.com/kywch/)
 *
 * jspsych plugin for threading the RC-RAGE trials
 * 
 **/

/*
 * Generic task variables
 */
var sbj_id = ""; // mturk id
var task_id = ""; // the prefix for the save file -- the main seq
var data_dir = "";


/* 
 * RC-RAGE specific variables
 */
var flag_debug = false;
var flag_save = false;
var take_back_amount = 3; // default value
var main_score = 0;
var main_score_robber = 200;
var prac_score = 20;
var prac_score_robber = 200;
var prac_time = 2 * 60 * 1000; // ms
var circle_loc = null;
if (flag_debug) {
    // shooting for 3 trials (6 harvests) within 3 minutes
    var time_limit = 3 * 60 * 1000; // ms
    var main_seq = [Infinity].concat(jsPsych.randomization.shuffle([1, 2, 3, 4, 6, 7, Infinity, Infinity]));
    var break_after_trial = [2];
    var break_after_trial = [3, 7];

} else {
    var time_limit = 12 * 60 * 1000; // ms
    var main_seq = [Infinity].concat(jsPsych.randomization.shuffle([1, 2, 3, 4, 6, 7, Infinity, Infinity]));
    main_seq = main_seq.concat(jsPsych.randomization.shuffle([1, 2, 3, 4, 6, 7, Infinity, Infinity, Infinity]));
    main_seq = main_seq.concat(jsPsych.randomization.shuffle([1, 2, 3, 4, 6, 7, Infinity, Infinity, Infinity]));
    var break_after_trial = [3, 7, 11, 15, 19, 23];
}
var score_history = [];
var click_history = [];
var wasted_click_history = [];

// a single result string will be generated for saving to qualtrics
var result_string = 'trial steal_timing finish_code click_cnt extra_click points rt time_remain;';

// activity tracking
var focus = 'focus'; // tracks if the current tab/window is the active tab/window, initially the current tab should be focused
var fullscr_ON = 'no'; // tracks fullscreen activity, initially not activated
var record_mouse = false;

/*
 * Helper functions
 */

// YOU MUST GET YOUR OWN DROPBOX ACCESS TOKEN for uploading the file to your dropbox
// from https://dropbox.github.io/dropbox-api-v2-explorer/#files_upload
var dropbox_access_token = '';
var save_filename = '/' + task_id + '_' + sbj_id + '.json';

function save_data() {
    // if you prefer json-format, use jsPsych.data.get().json()
    // if you prefer csv-format, use jsPsych.data.get().csv()
    if (flag_debug) {
        console.log("Save data function called.");
        //console.log(jsPsych.data.get().json());
    }
    try {
        var dbx = new Dropbox.Dropbox({
            fetch: fetch,
            accessToken: dropbox_access_token
        });
        dbx.filesUpload({
                path: save_filename,
                mode: 'overwrite',
                mute: true,
                contents: jsPsych.data.get().json()
            })
            .then(function (response) {
                if (flag_debug) {
                    console.log(response);
                }
            })
            .catch(function (error) {
                console.error(error);
            });
    } catch (err) {
        console.log("Save data function failed.", err);
    }
}

var audio_url = 'https://kywch.github.io/RC-RAGE_jsPsych/sounds/';
var audio_seed = ['c', 'd', 'g', 'k', 'p', 'q', 't'];

function get_audio_url(audio_char) { // CHECK THE URL before use
    return audio_url + audio_char + '.mp3';
}

/*
 * Instruction page -> import image instructions and display
 */

function get_instruction_imglist(instr_url, num_slides = 28) {
    var imglist = [];
    for (var ii = 0; ii < num_slides; ii++) {
        imglist.push(instr_url + 'Slide' + (ii).toString() + '.JPG');
    }
    return imglist;
}


// A map of the slide indexes to group them by instruction block.

const slides = get_instruction_imglist('instruction/', 28);


getSlideGroupAsHtml = (group) => {
   return htmlified = group.map(slide => `<img class="resize" src="${slide}">`);
};

const slideGroups = {
    intro: getSlideGroupAsHtml(slides.slice(0, 12)),
    instructions: {
        steal: getSlideGroupAsHtml(slides.slice(12, 15)),
        shoot: getSlideGroupAsHtml(slides.slice(16, 19)),
        retalation: getSlideGroupAsHtml(slides.slice(20, 23)),
        final: getSlideGroupAsHtml(slides.slice(23, 28)),
    },
    audioTests: {
        giggle: slides[15],
        yeehaw: slides[19],
    },
};

function generate_instruction_block(imglist, takeBackAmount = take_back_amount) {

    var block_instruction = [];

    var RAGE_instruction_page_1 = {
        type: 'instructions',
        pages: slideGroups.intro,
        data: {
            exp_stage: 'RC-RAGE_instruction_page_1',
            task_id: function () {
                return task_id;
            },
            sbj_id: function () {
                return sbj_id;
            }
        },
        allow_keys: false,
        show_clickable_nav: true,
        show_page_number: true
    };
    block_instruction.push(RAGE_instruction_page_1);

    // single money-making practice trial
    var RAGE_instruction_harvest_practice = {
        type: 'rc-rage',
        prompt: '<div width="800px"><p class = block-text><i>Click the green apple and earn 20 cents to proceed.</i></p></div>',
        data: {
            exp_stage: 'RC-RAGE_instruction_harvest_practice',
            task_id: function () {
                return task_id;
            },
            sbj_id: function () {
                return sbj_id;
            }
        }
    };
    // DISABLE APPLE SHOOTING PRACTICE BLOCK
    block_instruction.push(RAGE_instruction_harvest_practice);

    var RAGE_instruction_page_2 = {
        type: 'instructions',
        pages: slideGroups.instructions.steal,
        data: {
            exp_stage: 'RC-RAGE_instruction_page_2'
        },
        allow_keys: false,
        show_clickable_nav: true,
        show_page_number: true
    };
    block_instruction.push(RAGE_instruction_page_2);

    // after this stealing happens
    var RAGE_instruction_steal = {
        type: 'audio-keyboard-with-replay',
        stimulus: audio_url + '170623_jorickhoofd_funny-high-giggle.mp3',
        prompt: '<img class="resize" src="' + slideGroups.audioTests.giggle + '">', // Slide17
        choices: ['y'],
        replay_key: 'n',
        data: {
            exp_stage: 'RC-RAGE_instruction_steal'
        }
    }
    block_instruction.push(RAGE_instruction_steal);

    var RAGE_instruction_page_3 = {
        type: 'instructions',
        pages: slideGroups.instructions.retalation,
        data: {
            exp_stage: 'RC-RAGE_instruction_page_3'
        },
        allow_keys: false,
        show_clickable_nav: true,
        show_page_number: true
    };
    block_instruction.push(RAGE_instruction_page_3);

    // after this stealing happens
    var RAGE_instruction_escape = {
        type: 'audio-keyboard-with-replay',
        stimulus: audio_url + 'Yahoo-SoundBible.com-1888534056.mp3',
        prompt: '<img class="resize" src="' + slideGroups.audioTests.yeehaw + '">', // Slide21
        choices: ['y'],
        replay_key: 'n',
        data: {
            exp_stage: 'RC-RAGE_instruction_escape'
        }
    }
    block_instruction.push(RAGE_instruction_escape);

    var RAGE_instruction_page_4 = {
        type: 'instructions',
        pages: slideGroups.instructions.retalation,
        data: {
            exp_stage: 'RC-RAGE_instruction_page_4'
        },
        allow_keys: false,
        show_clickable_nav: true,
        show_page_number: true
    };
    block_instruction.push(RAGE_instruction_page_4);

    // single shooting practice trial
    var RAGE_instruction_shooting_practice = {
        type: 'rc-rage',
        cumulative_points_player: 15,
        prompt: '<p class = block-text><i>Destroy the smiley robber to continue.</i></p>',
        shoot_prac: true,
        takeback_amount: takeBackAmount,
        steal_amount: 5,
        data: {
            exp_stage: 'RC-RAGE_instruction_shooting_practice'
        }
    };
    block_instruction.push(RAGE_instruction_shooting_practice);

    var RAGE_instruction_page_5 = {
        type: 'instructions',
        pages: slideGroups.instructions.final,
        data: {
            exp_stage: 'RC-RAGE_instruction_page_5'
        },
        allow_keys: false,
        show_clickable_nav: true,
        show_page_number: true,
        on_finish: function () {
            if (flag_save) {
                save_data();
            }
            circle_loc = null;
        }
    };
    block_instruction.push(RAGE_instruction_page_5);

    return block_instruction;
}


/*
 * 2 minutes of task practice
 */
function generate_practice_block(takeBackAmount = take_back_amount, smileyGoneBeforeHarvest = true, audioTest = true) {
    // time limit: 2 minutes
    var prac_seq = [5, 5, 5, 5, 5, 5]; // [3, 7, 3, 7, 3, 7];
    var audio_testseq = jsPsych.randomization.shuffle([...audio_seed]);

    if (flag_debug) {
        console.log("Take back amount: ", takeBackAmount);
        console.log("Smiley gone before harvest: ", smileyGoneBeforeHarvest);
        console.log("Audio test: ", audioTest);
    }

    var block_sequence = [];

    for (var ii = 0; ii < prac_seq.length; ii++) {

        var continuous_rage = {
            type: 'rc-rage',
            cumulative_points_player: function () {
                return prac_score;
            },
            cumulative_points_robber: function () {
                return prac_score_robber;
            },
            time_remain: function () {
                return prac_time;
            },
            prev_circle_loc: function () {
                return circle_loc;
            },
            prompt: '<div style="width:800px"><p class = block-text><i>Try to earn as many cents as possible for the next 2 minutes of practice.</p></div>',
            //prompt: '<div style="width:800px"><p class = block-text><i>Feel free to try anything for the next 2 minutes of practice. ' +
            //    'The practice points will <b>NOT</b> be exchanged for money.</i></p></div>',
            steal_timing: prac_seq[ii],
            escape_before_harvest: smileyGoneBeforeHarvest,
            takeback_amount: takeBackAmount,
            record_mouse: function () {
                return record_mouse;
            },
            data: {
                exp_stage: 'practice_trial_RC-RAGE_' + (ii + 1).toString()
            },
            on_finish: function (data) {
                // update the score and circle_loc
                prac_score = prac_score + data.points_trial;
                prac_score_robber = prac_score_robber + data.points_trial_robber;
                prac_time = data.time_remain;
                circle_loc = data.last_circle_loc;
            }
        };
        block_sequence.push(continuous_rage);

        // audio-test break
        var audiotest_trial = {
            type: 'audio-keyboard-with-replay',
            time_remain: function () {
                return prac_time;
            },
            stimulus: get_audio_url(audio_testseq[ii]),
            prompt: "<div class = centerbox><p class = block-text>" +
                "<p class = block-text><font color=red><strong>Attention check!</strong> THE TIMER IS STILL RUNNING.</font></p>" +
                "<p class = block-text>Please press the alphabet key you just heard.</p> " +
                "<p class = block-text>To replay, press the <strong>'r'</strong> key. </p></div>",
            choices: [audio_testseq[ii]],
            data: {
                exp_stage: 'audiotest_trial_' + ii.toString(),
                played_audio: audio_testseq[ii]
            },
            on_finish: function (data) {
                if (flag_debug) {
                    console.log("Audio-test RT: ", data.rt, prac_time);
                }
                // update the time
                prac_time = prac_time - data.rt;
            }
        };
        if (audioTest) {
            if ([0, 2].includes(ii)) {
                block_sequence.push(audiotest_trial);
            }
        }
    }
    return block_sequence;
}


/*
 * 12 minutes of task practice
 */
function generate_main_block(takeBackAmount = take_back_amount, smileyGoneBeforeHarvest = true) {

    var audio_testseq = jsPsych.randomization.shuffle([...audio_seed]);

    var block_sequence = [];

    const RAGE_matchmaking = {
        type: 'matchmaking',
        matchmaking_duration: 18000, // the amount on time in ms it takes to "find an opponent"
        matchmaking_initialize_duration: 5000, // the amount on time the post-matchmaking confirmation stays on screen
        //   matchmaking_display_text: STR default 'Please wait while we find an opponent...',
        //   matchmaking_confirmation_text: 'Opponent found. Initializing game session.',
    };

    block_sequence.push(RAGE_matchmaking);

    for (var ii = 0; ii < main_seq.length; ii++) {
        var continuous_rage = {
            type: 'rc-rage',
            cumulative_points_player: function () {
                return main_score;
            },
            cumulative_points_robber: function () {
                return main_score_robber;
            },
            time_remain: function () {
                return time_limit;
            },
            prev_circle_loc: function () {
                return circle_loc;
            },
            steal_timing: main_seq[ii],
            escape_before_harvest: smileyGoneBeforeHarvest,
            takeback_amount: takeBackAmount,
            record_mouse: function () {
                return record_mouse;
            },
            data: {
                exp_stage: 'main_trial_RC-RAGE_' + (ii + 1).toString(),
                trial_cnt: (ii + 1).toString(),
                steal_timing: main_seq[ii].toString()
            },
            on_finish: function (data) {
                // update the variables to feed into the next trial
                main_score = main_score + data.points_trial;
                main_score_robber = main_score_robber + data.points_trial_robber;
                time_limit = data.time_remain;
                circle_loc = data.last_circle_loc;

                // quick result summary
                score_history.push(data.points_trial);
                click_history.push(data.click_history.length);
                wasted_click_history.push(data.wasted_click);

                if (time_limit > 0 || data.finish_code == 99) {
                    // csv-like string: delimiter - space (' '), newline - semicolon (';')
                    //results_string = 'trial steal_timing finish_code click_cnt extra_click points rt time_remain;';
                    result_string += data.trial_cnt + ' ' + // trial
                        data.steal_timing + ' ' + // steal_timing
                        data.finish_code.toString() + ' ' + // finish_code
                        data.click_history.length.toString() + ' ' + // click_cnt
                        data.wasted_click.toString() + ' ' + // extra_click
                        data.points_trial.toString() + ' ' + // points
                        Math.round(data.rt).toString() + ' ' + // rt
                        Math.round(time_limit).toString() + ';'; // time_remain
                } else {
                    result_string += data.trial_cnt + ' ' + // trial
                        data.steal_timing + ' ' + // steal_timing
                        data.finish_code.toString() + ' ' + // finish_code
                        'NaN ' + // click_cnt
                        'NaN ' + // extra_click
                        'NaN ' + // points
                        'NaN ' + // rt
                        'NaN;'; // time_remain
                }
            }
        };
        block_sequence.push(continuous_rage);

        // break page
        if (break_after_trial.includes(ii)) {

            var audiotest_trial = {
                type: 'audio-keyboard-with-replay',
                time_remain: function () {
                    return time_limit;
                },
                stimulus: get_audio_url(audio_testseq[Math.floor(ii / 4)]),
                prompt: "<div class = centerbox><p class = block-text>" +
                    "<p class = block-text><font color=red><strong>Attention check!</strong> THE TIMER IS STILL RUNNING.</font></p>" +
                    "<p class = block-text>Please press the alphabet key you just heard.</p> " +
                    "<p class = block-text>To replay, press the <strong>'r'</strong> key. </p></div>",
                choices: [audio_testseq[Math.floor(ii / 4)]],
                data: {
                    exp_stage: 'audiotest_trial_' + ii.toString(),
                    played_audio: audio_testseq[Math.floor(ii / 4)]
                },
                on_finish: function (data) {
                    if (flag_save) {
                        save_data();
                    }
                    if (flag_debug) {
                        console.log("Audio-test RT: ", data.rt, time_limit);
                    }
                    // update the time
                    time_limit = time_limit - data.rt;

                    if (time_limit > 0) {
                        // csv-like string: delimiter - space (' '), newline - semicolon (';')
                        //results_string = 'trial steal_timing finish_code click_cnt extra_click points rt time_remain;';
                        result_string += 'attn ' + // trial
                            'NaN ' + // steal_timing
                            'NaN ' + // finish_code
                            'NaN ' + // click_cnt
                            'NaN ' + // extra_click
                            'NaN ' + // points
                            Math.round(data.rt).toString() + ' ' + // rt
                            Math.round(time_limit).toString() + ';'; // time_remain
                    } else {
                        result_string += 'attn ' + // trial
                            'NaN ' + // steal_timing
                            'NaN ' + // finish_code
                            'NaN ' + // click_cnt
                            'NaN ' + // extra_click
                            'NaN ' + // points
                            'NaN ' + // rt
                            'NaN;'; // time_remain
                    }
                }
            }
            block_sequence.push(audiotest_trial);
        }
    }

    return block_sequence;
}
