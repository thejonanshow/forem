import { h, Fragment } from 'preact';
import { useState, useEffect, useRef, useLayoutEffect } from 'preact/hooks';
import PropTypes from 'prop-types';
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
} from '@reach/combobox';
import '@reach/combobox/styles.css';
import { getMentionWordData, getCursorXY } from '@utilities/textAreaUtils';
import { useMediaQuery, BREAKPOINTS } from '@components/useMediaQuery';

const MIN_SEARCH_CHARACTERS = 2;
const MAX_RESULTS_DISPLAYED = 6;

const UserListItemContent = ({ user }) => {
  return (
    <Fragment>
      <span className="crayons-avatar crayons-avatar--l mr-2 shrink-0">
        <img
          src={user.profile_image_90}
          alt=""
          className="crayons-avatar__image "
        />
      </span>

      <div>
        <p className="crayons-autocomplete__name">{user.name}</p>
        <p className="crayons-autocomplete__username">{`@${user.username}`}</p>
      </div>
    </Fragment>
  );
};

/**
 * A component for dynamically searching for users and displaying results in a dropdown.
 * This component will replace the textarea passed in props, copying all styles and attributes, and allowing for progressive enhancement
 *
 * @param {object} props
 * @param {element} props.replaceElement The textarea DOM element that should be replaced
 * @param {function} props.fetchSuggestions The async call to use for the search
 *
 * @example
 * <MentionAutocompleteCombobox
 *    replaceElement={textAreaRef.current}
 *    fetchSuggestions={fetchUsersByUsername}
 * />
 */
export const MentionAutocompleteTextArea = ({
  replaceElement,
  fetchSuggestions,
}) => {
  const [textContent, setTextContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cachedSearches, setCachedSearches] = useState({});
  const [dropdownPositionPoints, setDropdownPositionPoints] = useState({
    x: 0,
    y: 0,
  });
  const [selectionInsertIndex, setSelectionInsertIndex] = useState(0);
  const [users, setUsers] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(null);
  const [ariaHelperText, setAriaHelperText] = useState('');

  const isSmallScreen = useMediaQuery(`(max-width: ${BREAKPOINTS.Small}px)`);

  const inputRef = useRef(null);

  useEffect(() => {
    if (searchTerm.length >= MIN_SEARCH_CHARACTERS) {
      if (cachedSearches[searchTerm]) {
        setUsers(cachedSearches[searchTerm]);
        return;
      }

      fetchSuggestions(searchTerm).then(({ result: fetchedUsers }) => {
        const resultLength = Math.min(
          fetchedUsers.length,
          MAX_RESULTS_DISPLAYED,
        );

        const results = fetchedUsers.slice(0, resultLength);

        setCachedSearches({
          ...cachedSearches,
          [searchTerm]: results,
        });

        setUsers(results);

        // Let screen reader users know a list has populated
        const requiresAriaLiveAnnouncement =
          !ariaHelperText && fetchedUsers.length > 0;

        if (requiresAriaLiveAnnouncement) {
          setAriaHelperText(
            `Mention user, ${fetchedUsers.length} results found`,
          );
        }
      });
    }
  }, [searchTerm, fetchSuggestions, cachedSearches, ariaHelperText]);

  useLayoutEffect(() => {
    const popover = document.getElementById('mention-autocomplete-popover');
    if (!popover) {
      return;
    }

    const closeOnClickOutsideListener = (event) => {
      if (!popover.contains(event.target)) {
        // User clicked outside, reset to not searching state
        setSearchTerm('');
        setAriaHelperText('');
        setUsers([]);
      }
    };

    document.addEventListener('click', closeOnClickOutsideListener);

    return () =>
      document.removeEventListener('click', closeOnClickOutsideListener);
  }, [searchTerm]);

  useLayoutEffect(() => {
    inputRef.current.focus();
    inputRef.current.setSelectionRange(cursorPosition, cursorPosition - 1);
  }, [cursorPosition]);

  const handleValueChange = ({ target: { value } }) => {
    setTextContent(value);
    const { isUserMention, indexOfMentionStart } = getMentionWordData(
      inputRef.current,
    );

    const { selectionStart } = inputRef.current;

    if (isUserMention) {
      // search term begins after the @ character
      const searchTermStartPosition = indexOfMentionStart + 1;

      const mentionText = value.substring(
        searchTermStartPosition,
        selectionStart,
      );

      const { x: cursorX, y } = getCursorXY(
        inputRef.current,
        indexOfMentionStart,
      );
      const textAreaX = inputRef.current.offsetLeft;

      // On small screens always show dropdown at start of textarea
      const dropdownX = isSmallScreen ? textAreaX : cursorX;

      setDropdownPositionPoints({ x: dropdownX, y });
      setSearchTerm(mentionText);
      setSelectionInsertIndex(searchTermStartPosition);
    } else if (searchTerm) {
      // User has moved away from an in-progress @mention - clear current search
      setSearchTerm('');
      setAriaHelperText('');
      setUsers([]);
    }
  };

  const handleSelect = (username) => {
    const textWithSelection = `${textContent.substring(
      0,
      selectionInsertIndex,
    )}${username}${textContent.substring(inputRef.current.selectionStart)}`;

    // Clear the current search
    setSearchTerm('');
    setUsers([]);
    setAriaHelperText('');

    // Update the text area value
    setTextContent(textWithSelection);

    // Update the cursor to directly after the selection
    const newCursorPosition = selectionInsertIndex + username.length + 1;
    setCursorPosition(newCursorPosition);
  };

  useLayoutEffect(() => {
    if (inputRef.current) {
      const attributes = replaceElement.attributes;
      Object.keys(attributes).forEach((attributeKey) => {
        inputRef.current.setAttribute(
          attributes[attributeKey].name,
          attributes[attributeKey].value,
        );
      });

      inputRef.current.style.cssText = document.defaultView.getComputedStyle(
        replaceElement,
        '',
      ).cssText;

      // We need to manually remove the element, as Preact's diffing algorithm won't replace it in render
      replaceElement.remove();
      inputRef.current.focus();
    }
  }, [replaceElement]);

  return (
    <Fragment>
      <div aria-live="polite" class="screen-reader-only">
        {ariaHelperText}
      </div>
      <Combobox
        id="combobox-container"
        onSelect={handleSelect}
        className="crayons-autocomplete"
      >
        <ComboboxInput
          ref={inputRef}
          value={textContent}
          data-mention-autocomplete-active="true"
          as="textarea"
          autocomplete={false}
          onChange={handleValueChange}
        />
        {searchTerm && (
          <ComboboxPopover
            className="crayons-autocomplete__popover"
            id="mention-autocomplete-popover"
            style={{
              position: 'absolute',
              top: `calc(${dropdownPositionPoints.y}px + 1.5rem)`,
              left: `${dropdownPositionPoints.x}px`,
            }}
          >
            {users.length > 0 ? (
              <ComboboxList>
                {users.map((user) => (
                  <ComboboxOption
                    value={user.username}
                    className="crayons-autocomplete__option flex items-center"
                  >
                    <UserListItemContent user={user} />
                  </ComboboxOption>
                ))}
              </ComboboxList>
            ) : (
              <span className="crayons-autocomplete__empty">
                {searchTerm.length >= MIN_SEARCH_CHARACTERS
                  ? 'No results found'
                  : 'Type to search for a user'}
              </span>
            )}
          </ComboboxPopover>
        )}
      </Combobox>
    </Fragment>
  );
};

MentionAutocompleteTextArea.propTypes = {
  replaceElement: PropTypes.node.isRequired,
  fetchSuggestions: PropTypes.func.isRequired,
};
