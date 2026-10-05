package org.polarisos.field.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.polarisos.field.ui.theme.PolarisColors
import org.polarisos.field.ui.theme.PolarisDimens

@Composable
fun PolarisTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    isError: Boolean = false,
    errorMessage: String? = null,
    singleLine: Boolean = true,
    minLines: Int = 1,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    enabled: Boolean = true
) {
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            enabled = enabled,
            singleLine = singleLine,
            minLines = minLines,
            label = { Text(label, fontSize = 13.sp) },
            placeholder = placeholder?.let { { Text(it, color = PolarisColors.TextFaint, fontSize = 13.sp) } },
            isError = isError,
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            visualTransformation = visualTransformation,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            shape = RoundedCornerShape(PolarisDimens.radiusSm),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = PolarisColors.PolarSurface,
                unfocusedContainerColor = PolarisColors.PolarSurface,
                disabledContainerColor = PolarisColors.PolarSurfaceAlt,
                errorContainerColor = PolarisColors.PolarSurface,

                focusedBorderColor = PolarisColors.LineFocus,
                unfocusedBorderColor = PolarisColors.LineLight,
                disabledBorderColor = PolarisColors.LineSubtle,
                errorBorderColor = PolarisColors.StatusCritical,

                focusedLabelColor = PolarisColors.PolarBlueDark,
                unfocusedLabelColor = PolarisColors.TextMuted,
                errorLabelColor = PolarisColors.StatusCritical,

                focusedTextColor = PolarisColors.TextPrimary,
                unfocusedTextColor = PolarisColors.TextPrimary,
                disabledTextColor = PolarisColors.TextFaint
            )
        )
        if (isError && !errorMessage.isNullOrBlank()) {
            Text(
                text = errorMessage,
                color = PolarisColors.StatusCritical,
                fontSize = 11.sp,
                modifier = Modifier.padding(start = 6.dp, top = 4.dp)
            )
        }
    }
}
